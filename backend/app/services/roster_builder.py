"""Build era-scoped roster pools from team + decade rolls."""

from __future__ import annotations

import random

from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from app.models.roster_entry import RosterEntry
from app.schemas.common import RosterEntity, RosterResponse

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

TEAM_DISPLAY_NAMES: dict[str, str] = {
    "alpine": "Alpine",
    "aston-martin": "Aston Martin",
    "benetton": "Benetton",
    "brabham": "Brabham",
    "brawn": "Brawn GP",
    "cadillac": "Cadillac",
    "cooper": "Cooper",
    "ferrari": "Ferrari",
    "haas": "Haas",
    "jordan": "Jordan",
    "lotus": "Lotus",
    "matra": "Matra",
    "mclaren": "McLaren",
    "mercedes": "Mercedes",
    "rb": "RB",
    "red-bull": "Red Bull",
    "renault": "Renault",
    "sauber": "Sauber",
    "tyrrell": "Tyrrell",
    "williams": "Williams",
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

LEAD_ENGINEER_FALLBACK_WARNING = (
    "No lead engineer on file — technical directors can fill this slot"
)
TECHNICAL_DIRECTOR_FALLBACK_WARNING = (
    "No technical director on file — team principals can fill this slot"
)

MIN_DRIVERS = 3


def team_display_name(team_slug: str) -> str:
    return TEAM_DISPLAY_NAMES.get(team_slug, team_slug.replace("-", " ").title())


def decade_bounds(decade: str) -> tuple[int, int]:
    bounds: dict[str, tuple[int, int]] = {
        "1950s": (1950, 1959),
        "1960s": (1960, 1969),
        "1970s": (1970, 1979),
        "1980s": (1980, 1989),
        "1990s": (1990, 1999),
        "2000s": (2000, 2009),
        "2010s": (2010, 2019),
        "2020s": (2020, 2029),
    }
    if decade not in bounds:
        raise ValueError(f"Unknown decade: {decade}")
    return bounds[decade]


def _seeded_rng(session_seed: str, salt: str) -> random.Random:
    return random.Random(f"{session_seed}:{salt}")


def roll_team(
    db: Session,
    session_seed: str,
    excluded_team_slugs: list[str] | None = None,
    reroll_salt: str | None = None,
) -> tuple[str, str]:
    excluded = set(excluded_team_slugs or [])
    slugs = [
        row[0]
        for row in db.execute(select(distinct(RosterEntry.team_slug))).all()
        if row[0] not in excluded
    ]
    if not slugs:
        slugs = [row[0] for row in db.execute(select(distinct(RosterEntry.team_slug))).all()]
    if not slugs:
        raise ValueError("No teams in roster data. Import f1roller_roster_master.csv first.")
    salt = f"team:{reroll_salt or 'initial'}"
    chosen = _seeded_rng(session_seed, salt).choice(slugs)
    return chosen, team_display_name(chosen)


def decades_for_team(db: Session, team_slug: str) -> list[str]:
    decades = [
        row[0]
        for row in db.execute(
            select(distinct(RosterEntry.decade)).where(RosterEntry.team_slug == team_slug)
        ).all()
    ]
    return sorted(decades, key=lambda d: DECADES.index(d) if d in DECADES else 99)


def roll_decade(
    db: Session,
    session_seed: str,
    team_slug: str,
    reroll_salt: str | None = None,
) -> str:
    decades = decades_for_team(db, team_slug)
    if not decades:
        raise ValueError(f"No decades available for team: {team_slug}")
    salt = f"decade:{reroll_salt or 'initial'}"
    return _seeded_rng(session_seed, salt).choice(decades)


def _stats_summary(entry: RosterEntry) -> str | None:
    stats = entry.stats_json or {}
    if entry.entity_type == "driver":
        return (
            f"{stats.get('wins', 0)} wins, {stats.get('poles', 0)} poles, "
            f"{stats.get('championships', 0)} titles"
        )
    if entry.entity_type in ("engine", "chassis"):
        wins = stats.get("wins", 0)
        return f"{wins} wins" if wins else None
    if entry.entity_type == "personnel":
        return f"Rating {(entry.computed_rating * 100):.0f}"
    return None


def _api_entity_type(entry: RosterEntry) -> str:
    if entry.entity_type == "chassis":
        return "constructor"
    return entry.entity_type


def _personnel_slots(
    role: str | None,
    *,
    allow_td_as_le: bool,
    allow_tp_as_td: bool,
    allow_tp_as_le: bool,
) -> list[str]:
    if not role:
        return []
    slots = list(ROLE_SLOTS.get(role, []))
    if allow_td_as_le and role == "technical_director":
        slots.append("lead_engineer")
    if allow_tp_as_td and role == "team_principal":
        slots.append("technical_director")
    if allow_tp_as_le and role == "team_principal":
        slots.append("lead_engineer")
    return slots


def _entry_to_roster_entity(
    entry: RosterEntry,
    *,
    allow_td_as_le: bool,
    allow_tp_as_td: bool,
    allow_tp_as_le: bool,
) -> RosterEntity:
    entity_type = _api_entity_type(entry)

    if entry.entity_type == "driver":
        assignable = DRIVER_SLOTS
        role_label = "Driver"
    elif entry.entity_type == "chassis":
        assignable = ["constructor"]
        role_label = "Chassis"
    elif entry.entity_type == "engine":
        assignable = ["engine"]
        role_label = "Engine"
    elif entry.entity_type == "personnel":
        assignable = _personnel_slots(
            entry.personnel_role,
            allow_td_as_le=allow_td_as_le,
            allow_tp_as_td=allow_tp_as_td,
            allow_tp_as_le=allow_tp_as_le,
        )
        role_label = ROLE_LABELS.get(entry.personnel_role or "", entry.personnel_role)
    elif entry.entity_type == "sponsor":
        slot = "title_sponsor" if entry.sponsor_tier == "title" else "secondary_sponsor"
        assignable = [slot]
        role_label = "Title Sponsor" if slot == "title_sponsor" else "Secondary Sponsor"
    elif entry.entity_type == "livery":
        assignable = ["livery_style"]
        role_label = "Livery"
    elif entry.entity_type == "motto":
        assignable = ["team_motto"]
        role_label = "Motto"
    else:
        assignable = []
        role_label = None

    return RosterEntity(
        id=str(entry.id),
        slug=entry.slug,
        display_name=entry.display_name,
        entity_type=entity_type,
        nationality=entry.nationality,
        peak_year=entry.peak_year,
        stats_summary=_stats_summary(entry),
        computed_rating=entry.computed_rating,
        portrait_path=None,
        accent_color=entry.accent_color,
        assignable_slots=assignable,
        role_label=role_label,
    )


def build_roster(db: Session, team_slug: str, decade: str) -> RosterResponse:
    if decade not in DECADES:
        raise ValueError(f"Unknown decade: {decade}")

    entries = (
        db.query(RosterEntry)
        .filter(RosterEntry.team_slug == team_slug, RosterEntry.decade == decade)
        .all()
    )
    if not entries:
        raise ValueError(f"Unknown team or decade: {team_slug} / {decade}")

    has_lead_engineer = any(
        e.entity_type == "personnel" and e.personnel_role == "lead_engineer" for e in entries
    )
    has_technical_director = any(
        e.entity_type == "personnel" and e.personnel_role == "technical_director" for e in entries
    )
    allow_td_as_le = not has_lead_engineer and has_technical_director
    allow_tp_as_td = not has_technical_director
    allow_tp_as_le = not has_lead_engineer and not has_technical_director
    warnings: list[str] = []
    if not has_lead_engineer:
        warnings.append(LEAD_ENGINEER_FALLBACK_WARNING)
    if allow_tp_as_td:
        warnings.append(TECHNICAL_DIRECTOR_FALLBACK_WARNING)

    entities = [
        _entry_to_roster_entity(
            entry,
            allow_td_as_le=allow_td_as_le,
            allow_tp_as_td=allow_tp_as_td,
            allow_tp_as_le=allow_tp_as_le,
        )
        for entry in entries
    ]
    entities = [e for e in entities if e.assignable_slots]

    drivers = [e for e in entities if e.entity_type == "driver"]
    if len(drivers) < MIN_DRIVERS:
        warnings.append(f"Thin driver pool — only {len(drivers)} drivers available")

    return RosterResponse(
        team_slug=team_slug,
        team_display_name=team_display_name(team_slug),
        decade=decade,
        entities=entities,
        pool_warnings=warnings,
    )
