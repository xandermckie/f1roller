"""Build era-scoped roster pools from team + decade rolls."""

from __future__ import annotations

import random

from sqlalchemy.orm import Session

from app.models.constructor import Constructor
from app.models.driver import Driver
from app.models.engine_entity import EngineEntity
from app.models.personnel import Personnel
from app.models.sponsor import Sponsor
from app.schemas.common import RosterEntity, RosterResponse
from app.services.pools import LIVERY_STYLES, TEAM_MOTTOS

DECADES: list[str] = [
    "1950s",
    "1960s",
    "1970s",
    "1980s",
    "1990s",
    "2000s",
    "2010s",
    "2020s",
]

DECADE_BOUNDS: dict[str, tuple[int, int]] = {
    "1950s": (1950, 1959),
    "1960s": (1960, 1969),
    "1970s": (1970, 1979),
    "1980s": (1980, 1989),
    "1990s": (1990, 1999),
    "2000s": (2000, 2009),
    "2010s": (2010, 2019),
    "2020s": (2020, 2029),
}

DRIVER_SLOTS = ["driver_1", "driver_2", "reserve_driver"]

ROLE_SLOTS: dict[str, list[str]] = {
    "team_principal": ["team_principal"],
    "technical_director": ["technical_director"],
    "lead_engineer": ["lead_engineer"],
}

ROLE_LABELS: dict[str, str] = {
    "team_principal": "Team Principal",
    "technical_director": "Technical Director",
    "lead_engineer": "Lead Engineer",
}

# Approximate active years for sponsor slugs (fallback: all sponsors for tier)
SPONSOR_ERA: dict[str, tuple[int, int]] = {
    "marlboro": (1974, 1996),
    "camel": (1987, 1993),
    "west": (1997, 2005),
    "vodafone": (2007, 2013),
    "santander": (2007, 2017),
    "petronas": (2010, 2029),
    "oracle": (2021, 2029),
    "aramco": (2020, 2029),
    "ineos": (2021, 2029),
    "monster": (2017, 2029),
    "shell": (1950, 2029),
    "pirelli": (1950, 2029),
    "tag-heuer": (2016, 2029),
    "epson": (2015, 2029),
    "bwt": (2017, 2029),
    "teamviewer": (2021, 2024),
}

LIVERY_ERA: dict[str, tuple[int, int]] = {
    "classic": (1950, 2029),
    "modern": (2010, 2029),
    "neon": (2015, 2029),
    "marlboro-era": (1970, 1999),
}

MIN_DRIVERS = 3
MIN_ENGINES = 2
MIN_CONSTRUCTORS = 1
MIN_PERSONNEL_PER_ROLE = 1
MIN_SPONSORS = 2


def decade_bounds(decade: str) -> tuple[int, int]:
    if decade not in DECADE_BOUNDS:
        raise ValueError(f"Unknown decade: {decade}")
    return DECADE_BOUNDS[decade]


def _seeded_rng(session_seed: str, salt: str) -> random.Random:
    return random.Random(f"{session_seed}:{salt}")


def roll_team(
    db: Session,
    session_seed: str,
    excluded_team_slugs: list[str] | None = None,
    reroll_salt: str | None = None,
) -> tuple[str, str]:
    excluded = set(excluded_team_slugs or [])
    teams = [c for c in db.query(Constructor).all() if c.slug not in excluded]
    if not teams:
        teams = db.query(Constructor).all()
    salt = f"team:{reroll_salt or 'initial'}"
    chosen = _seeded_rng(session_seed, salt).choice(teams)
    return chosen.slug, chosen.display_name


def roll_decade(session_seed: str, reroll_salt: str | None = None) -> str:
    salt = f"decade:{reroll_salt or 'initial'}"
    return _seeded_rng(session_seed, salt).choice(DECADES)


def _year_in_range(year: int | None, start: int, end: int) -> bool:
    if year is None:
        return False
    return start <= year <= end


def _career_overlaps_decade(
    career_start: int | None,
    career_end: int | None,
    decade_start: int,
    decade_end: int,
) -> bool:
    start = career_start or 0
    end = career_end or 9999
    return start <= decade_end and end >= decade_start


def _driver_entity(d: Driver) -> RosterEntity:
    stats = d.stats_json or {}
    return RosterEntity(
        id=str(d.id),
        slug=d.slug,
        display_name=d.display_name,
        entity_type="driver",
        nationality=d.nationality,
        peak_year=d.peak_year,
        stats_summary=(
            f"{stats.get('wins', 0)} wins, {stats.get('poles', 0)} poles, "
            f"{stats.get('championships', 0)} titles"
        ),
        computed_rating=d.computed_rating,
        portrait_path=d.portrait_path,
        assignable_slots=DRIVER_SLOTS,
        role_label="Driver",
    )


def _constructor_entity(c: Constructor) -> RosterEntity:
    stats = c.stats_json or {}
    return RosterEntity(
        id=str(c.id),
        slug=c.slug,
        display_name=c.display_name,
        entity_type="constructor",
        peak_year=c.peak_year,
        stats_summary=f"{stats.get('wins', 0)} wins",
        computed_rating=c.computed_rating,
        assignable_slots=["constructor"],
        role_label="Chassis",
    )


def _engine_entity(e: EngineEntity) -> RosterEntity:
    stats = e.stats_json or {}
    return RosterEntity(
        id=str(e.id),
        slug=e.slug,
        display_name=e.display_name,
        entity_type="engine",
        peak_year=e.peak_year,
        stats_summary=f"{stats.get('wins', 0)} wins",
        computed_rating=e.computed_rating,
        assignable_slots=["engine"],
        role_label="Engine",
    )


def _personnel_entity(p: Personnel) -> RosterEntity:
    slots = ROLE_SLOTS.get(p.role, [])
    return RosterEntity(
        id=str(p.id),
        slug=p.slug,
        display_name=p.display_name,
        entity_type="personnel",
        peak_year=p.peak_year,
        stats_summary=f"Rating {(p.computed_rating * 100):.0f}",
        computed_rating=p.computed_rating,
        assignable_slots=slots,
        role_label=ROLE_LABELS.get(p.role, p.role),
    )


def _sponsor_entity(s: Sponsor, slot: str) -> RosterEntity:
    return RosterEntity(
        id=str(s.id),
        slug=s.slug,
        display_name=s.display_name,
        entity_type="sponsor",
        accent_color=s.accent_color,
        assignable_slots=[slot],
        role_label="Title Sponsor" if slot == "title_sponsor" else "Secondary Sponsor",
    )


def _livery_entity(item: dict[str, str]) -> RosterEntity:
    return RosterEntity(
        id=item["id"],
        slug=item["slug"],
        display_name=item["display_name"],
        entity_type="livery",
        assignable_slots=["livery_style"],
        role_label="Livery",
    )


def _motto_entity(item: dict[str, str]) -> RosterEntity:
    return RosterEntity(
        id=item["id"],
        slug=item["slug"],
        display_name=item["display_name"],
        entity_type="motto",
        assignable_slots=["team_motto"],
        role_label="Motto",
    )


def _filter_drivers(
    db: Session,
    team_slug: str,
    decade_start: int,
    decade_end: int,
    year_padding: int,
) -> list[RosterEntity]:
    start = decade_start - year_padding
    end = decade_end + year_padding
    result: list[RosterEntity] = []
    for d in db.query(Driver).filter(Driver.computed_rating > 0).all():
        teams = d.teams_history or []
        if team_slug not in teams:
            continue
        if not _career_overlaps_decade(d.career_start_year, d.career_end_year, start, end):
            continue
        result.append(_driver_entity(d))
    return result


def _filter_constructors(
    db: Session,
    team_slug: str,
    decade_start: int,
    decade_end: int,
    year_padding: int,
) -> list[RosterEntity]:
    start = decade_start - year_padding
    end = decade_end + year_padding
    rolled = db.query(Constructor).filter(Constructor.slug == team_slug).first()
    entities: list[RosterEntity] = []
    seen: set[str] = set()

    if rolled:
        entities.append(_constructor_entity(rolled))
        seen.add(str(rolled.id))

    for c in db.query(Constructor).all():
        if str(c.id) in seen:
            continue
        if _year_in_range(c.peak_year, start, end):
            entities.append(_constructor_entity(c))
            seen.add(str(c.id))

    return entities


def _filter_engines(
    db: Session,
    decade_start: int,
    decade_end: int,
    year_padding: int,
) -> list[RosterEntity]:
    start = decade_start - year_padding
    end = decade_end + year_padding
    return [
        _engine_entity(e)
        for e in db.query(EngineEntity).all()
        if _year_in_range(e.peak_year, start, end)
    ]


def _filter_personnel(
    db: Session,
    team_slug: str,
    decade_start: int,
    decade_end: int,
    year_padding: int,
) -> list[RosterEntity]:
    start = decade_start - year_padding
    end = decade_end + year_padding
    return [
        _personnel_entity(p)
        for p in db.query(Personnel).all()
        if p.role in ROLE_SLOTS
        and team_slug in (p.teams_history or [])
        and _year_in_range(p.peak_year, start, end)
    ]


def _sponsor_in_decade(slug: str, decade_start: int, decade_end: int) -> bool:
    era = SPONSOR_ERA.get(slug)
    if era is None:
        return True
    start, end = era
    return start <= decade_end and end >= decade_start


def _filter_sponsors(
    db: Session,
    tier: str,
    slot: str,
    decade_start: int,
    decade_end: int,
    *,
    use_all: bool,
) -> list[RosterEntity]:
    items = db.query(Sponsor).filter(Sponsor.tier == tier).all()
    if use_all:
        return [_sponsor_entity(s, slot) for s in items]
    return [
        _sponsor_entity(s, slot)
        for s in items
        if _sponsor_in_decade(s.slug, decade_start, decade_end)
    ]



def _livery_matches_decade(slug: str, decade_start: int, decade_end: int) -> bool:
    era = LIVERY_ERA.get(slug, (decade_start, decade_end))
    return era[0] <= decade_end and era[1] >= decade_start


def _filter_liveries_v2(decade_start: int, decade_end: int, *, use_all: bool) -> list[RosterEntity]:
    if use_all:
        return [_livery_entity(item) for item in LIVERY_STYLES]
    return [
        _livery_entity(item)
        for item in LIVERY_STYLES
        if _livery_matches_decade(item["slug"], decade_start, decade_end)
    ]


def build_roster(db: Session, team_slug: str, decade: str) -> RosterResponse:
    team = db.query(Constructor).filter(Constructor.slug == team_slug).first()
    if not team:
        raise ValueError(f"Unknown team: {team_slug}")
    if decade not in DECADE_BOUNDS:
        raise ValueError(f"Unknown decade: {decade}")

    decade_start, decade_end = decade_bounds(decade)
    warnings: list[str] = []

    driver_pad = 0
    engine_pad = 0
    personnel_pad = 0

    drivers = _filter_drivers(db, team_slug, decade_start, decade_end, driver_pad)
    if len(drivers) < MIN_DRIVERS:
        driver_pad = 5
        drivers = _filter_drivers(db, team_slug, decade_start, decade_end, driver_pad)
        if len(drivers) < MIN_DRIVERS:
            warnings.append("Thin driver pool — career window widened by 5 years")

    constructors = _filter_constructors(db, team_slug, decade_start, decade_end, 0)
    if len(constructors) < MIN_CONSTRUCTORS:
        constructors = _filter_constructors(db, team_slug, decade_start, decade_end, 5)
        warnings.append("Thin chassis pool — era window widened")

    engines = _filter_engines(db, decade_start, decade_end, engine_pad)
    if len(engines) < MIN_ENGINES:
        engine_pad = 5
        engines = _filter_engines(db, decade_start, decade_end, engine_pad)
        warnings.append("Thin engine pool — era window widened by 5 years")

    personnel = _filter_personnel(db, team_slug, decade_start, decade_end, personnel_pad)
    roles_present = {p.role_label for p in personnel if p.role_label}
    if len(roles_present) < len(ROLE_LABELS):
        personnel_pad = 8
        personnel = _filter_personnel(db, team_slug, decade_start, decade_end, personnel_pad)
        warnings.append("Thin staff pool — era window widened by 8 years")

    title_sponsors = _filter_sponsors(
        db, "title", "title_sponsor", decade_start, decade_end, use_all=False
    )
    secondary_sponsors = _filter_sponsors(
        db, "secondary", "secondary_sponsor", decade_start, decade_end, use_all=False
    )
    if len(title_sponsors) < MIN_SPONSORS:
        title_sponsors = _filter_sponsors(
            db, "title", "title_sponsor", decade_start, decade_end, use_all=True
        )
        warnings.append("Title sponsor pool expanded to all sponsors")
    if len(secondary_sponsors) < MIN_SPONSORS:
        secondary_sponsors = _filter_sponsors(
            db, "secondary", "secondary_sponsor", decade_start, decade_end, use_all=True
        )
        warnings.append("Secondary sponsor pool expanded to all sponsors")

    liveries = _filter_liveries_v2(decade_start, decade_end, use_all=False)
    if len(liveries) < 2:
        liveries = _filter_liveries_v2(decade_start, decade_end, use_all=True)
        warnings.append("Livery pool expanded to all styles")

    mottos = [_motto_entity(item) for item in TEAM_MOTTOS]

    entities = (
        drivers
        + constructors
        + engines
        + personnel
        + title_sponsors
        + secondary_sponsors
        + liveries
        + mottos
    )

    return RosterResponse(
        team_slug=team_slug,
        team_display_name=team.display_name,
        decade=decade,
        entities=entities,
        pool_warnings=warnings,
    )
