"""Roll pool queries and random selection."""

from __future__ import annotations

import random
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.constructor import Constructor
from app.models.driver import Driver
from app.models.engine_entity import EngineEntity
from app.models.personnel import Personnel
from app.models.sponsor import Sponsor
from app.schemas.common import PoolInfo, RolledEntity

SLOT_LABELS: dict[str, str] = {
    "driver_1": "Driver 1",
    "driver_2": "Driver 2",
    "reserve_driver": "Reserve Driver",
    "constructor": "Constructor",
    "engine": "Engine Supplier",
    "team_principal": "Team Principal",
    "technical_director": "Technical Director",
    "lead_engineer": "Lead Engineer",
    "title_sponsor": "Title Sponsor",
    "secondary_sponsor": "Secondary Sponsor",
    "livery_style": "Livery Style",
    "team_motto": "Team Motto",
}

LIVERY_STYLES = [
    {"id": "classic", "slug": "classic", "display_name": "Classic", "entity_type": "livery"},
    {"id": "modern", "slug": "modern", "display_name": "Modern", "entity_type": "livery"},
    {"id": "neon", "slug": "neon", "display_name": "Neon", "entity_type": "livery"},
    {"id": "marlboro-era", "slug": "marlboro-era", "display_name": "Marlboro Era", "entity_type": "livery"},
]

TEAM_MOTTOS = [
    {"id": "m1", "slug": "speed-eternal", "display_name": "Speed is eternal", "entity_type": "motto"},
    {"id": "m2", "slug": "never-settle", "display_name": "Never settle for second", "entity_type": "motto"},
    {"id": "m3", "slug": "pure-racing", "display_name": "Pure racing DNA", "entity_type": "motto"},
    {"id": "m4", "slug": "champions-mind", "display_name": "Champions' mindset", "entity_type": "motto"},
    {"id": "m5", "slug": "limitless", "display_name": "Beyond the limit", "entity_type": "motto"},
    {"id": "m6", "slug": "legacy", "display_name": "Write your legacy", "entity_type": "motto"},
]


def get_pool_info(db: Session, slot_id: str) -> PoolInfo:
    entities, _ = _query_pool(db, slot_id, [])
    sample = [e.display_name for e in entities[:5]]
    return PoolInfo(
        slot_id=slot_id,
        count=len(entities),
        label=SLOT_LABELS.get(slot_id, slot_id),
        sample_names=sample,
    )


def _query_pool(db: Session, slot_id: str, excluded_ids: list[str]) -> tuple[list[RolledEntity], str]:
    excluded_uuids = set(excluded_ids)

    if slot_id in ("driver_1", "driver_2", "reserve_driver"):
        query = db.query(Driver).filter(Driver.computed_rating > 0)
        drivers = query.all()
        entities = [
            RolledEntity(
                id=str(d.id),
                slug=d.slug,
                display_name=d.display_name,
                entity_type="driver",
                nationality=d.nationality,
                peak_year=d.peak_year,
                stats_summary=f"{d.stats_json.get('wins', 0)} wins, {d.stats_json.get('poles', 0)} poles",
                computed_rating=d.computed_rating,
                portrait_path=d.portrait_path,
            )
            for d in drivers
            if str(d.id) not in excluded_uuids
        ]
        return entities, "driver"

    if slot_id == "constructor":
        items = db.query(Constructor).all()
        return [
            RolledEntity(
                id=str(c.id),
                slug=c.slug,
                display_name=c.display_name,
                entity_type="constructor",
                peak_year=c.peak_year,
                stats_summary=f"{c.stats_json.get('wins', 0)} wins",
                computed_rating=c.computed_rating,
            )
            for c in items
            if str(c.id) not in excluded_uuids
        ], "constructor"

    if slot_id == "engine":
        items = db.query(EngineEntity).all()
        return [
            RolledEntity(
                id=str(e.id),
                slug=e.slug,
                display_name=e.display_name,
                entity_type="engine",
                peak_year=e.peak_year,
                stats_summary=f"{e.stats_json.get('wins', 0)} wins",
                computed_rating=e.computed_rating,
            )
            for e in items
            if str(e.id) not in excluded_uuids
        ], "engine"

    if slot_id == "team_principal":
        items = db.query(Personnel).filter(Personnel.role == "team_principal").all()
        return _personnel_entities(items, excluded_uuids), "personnel"

    if slot_id == "technical_director":
        items = db.query(Personnel).filter(Personnel.role == "technical_director").all()
        return _personnel_entities(items, excluded_uuids), "personnel"

    if slot_id == "lead_engineer":
        items = db.query(Personnel).filter(Personnel.role == "lead_engineer").all()
        return _personnel_entities(items, excluded_uuids), "personnel"

    if slot_id == "title_sponsor":
        items = db.query(Sponsor).filter(Sponsor.tier == "title").all()
        return _sponsor_entities(items, excluded_uuids), "sponsor"

    if slot_id == "secondary_sponsor":
        items = db.query(Sponsor).filter(Sponsor.tier == "secondary").all()
        return _sponsor_entities(items, excluded_uuids), "sponsor"

    if slot_id == "livery_style":
        return [
            RolledEntity(
                id=item["id"],
                slug=item["slug"],
                display_name=item["display_name"],
                entity_type="livery",
            )
            for item in LIVERY_STYLES
            if item["id"] not in excluded_uuids
        ], "livery"

    if slot_id == "team_motto":
        return [
            RolledEntity(
                id=item["id"],
                slug=item["slug"],
                display_name=item["display_name"],
                entity_type="motto",
            )
            for item in TEAM_MOTTOS
            if item["id"] not in excluded_uuids
        ], "motto"

    return [], "unknown"


def _personnel_entities(items: list[Personnel], excluded: set[str]) -> list[RolledEntity]:
    return [
        RolledEntity(
            id=str(p.id),
            slug=p.slug,
            display_name=p.display_name,
            entity_type="personnel",
            stats_summary=f"Rating {p.computed_rating:.2f}",
            computed_rating=p.computed_rating,
        )
        for p in items
        if str(p.id) not in excluded
    ]


def _sponsor_entities(items: list[Sponsor], excluded: set[str]) -> list[RolledEntity]:
    return [
        RolledEntity(
            id=str(s.id),
            slug=s.slug,
            display_name=s.display_name,
            entity_type="sponsor",
            accent_color=s.accent_color,
        )
        for s in items
        if str(s.id) not in excluded
    ]


def roll_entity(
    db: Session,
    slot_id: str,
    excluded_ids: list[str],
    session_seed: str | None = None,
) -> RolledEntity | None:
    entities, _ = _query_pool(db, slot_id, excluded_ids)
    if not entities:
        return None

    rng = random.Random(session_seed) if session_seed else random.Random()
    return rng.choice(entities)
