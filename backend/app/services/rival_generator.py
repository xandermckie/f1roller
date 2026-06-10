"""Generate 19 mixed-era rival teams."""

from __future__ import annotations

import hashlib
import random
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.roster_entry import RosterEntry
from app.services.synergy import EntityRef
from app.services.team_pace import TeamEntities


def _seeded_rng(team_ids: list[str], salt: int) -> random.Random:
    digest = hashlib.sha256(f"{':'.join(sorted(team_ids))}:{salt}".encode()).hexdigest()
    return random.Random(int(digest[:16], 16))


def _to_entity_ref(entry: RosterEntry) -> EntityRef:
    return EntityRef(
        slug=entry.slug,
        display_name=entry.display_name,
        peak_year=entry.peak_year,
        teams_history=entry.teams_history or [],
    )


def _best_by_slug(entries: list[RosterEntry]) -> list[RosterEntry]:
    best: dict[str, RosterEntry] = {}
    for entry in entries:
        existing = best.get(entry.slug)
        if existing is None or entry.computed_rating > existing.computed_rating:
            best[entry.slug] = entry
    return list(best.values())


def generate_rivals(
    db: Session,
    user_driver_ids: list[UUID],
    count: int = 19,
) -> list[TeamEntities]:
    all_entries = db.query(RosterEntry).all()
    if not all_entries:
        raise ValueError("Roster data is missing. Import f1roller_roster_master.csv first.")

    drivers = sorted(
        _best_by_slug([e for e in all_entries if e.entity_type == "driver"]),
        key=lambda e: e.computed_rating,
        reverse=True,
    )[:120]
    chassis = _best_by_slug([e for e in all_entries if e.entity_type == "chassis"])
    engines = _best_by_slug([e for e in all_entries if e.entity_type == "engine"])
    tps = [e for e in all_entries if e.entity_type == "personnel" and e.personnel_role == "team_principal"]
    tds = [e for e in all_entries if e.entity_type == "personnel" and e.personnel_role == "technical_director"]
    engineers = [
        e for e in all_entries if e.entity_type == "personnel" and e.personnel_role == "lead_engineer"
    ]
    if not engineers:
        engineers = tds

    if not chassis or not engines or not drivers or not tps:
        raise ValueError("Roster data is incomplete. Re-import f1roller_roster_master.csv.")

    excluded = {str(i) for i in user_driver_ids}
    used_drivers: set[str] = set(excluded)

    rivals: list[TeamEntities] = []
    team_ids = [str(i) for i in user_driver_ids]

    for i in range(count):
        rng = _seeded_rng(team_ids, i)

        constructor = rng.choice(chassis)
        engine = rng.choice(engines)

        available = [d for d in drivers if str(d.id) not in used_drivers]
        if len(available) < 3:
            used_drivers -= excluded
            available = [d for d in drivers if str(d.id) not in used_drivers]

        if not available:
            raise ValueError("Not enough drivers available to build rival teams.")

        selected = rng.sample(available, min(3, len(available)))
        while len(selected) < 3:
            selected.append(rng.choice(available))
        for driver in selected:
            used_drivers.add(str(driver.id))

        d1, d2, reserve = selected[0], selected[1], selected[2]
        tp = rng.choice(tps)
        td = rng.choice(tds) if tds else tp
        eng = rng.choice(engineers) if engineers else td

        team_name = f"{constructor.display_name} {engine.display_name} Racing"

        rivals.append(
            TeamEntities(
                driver_1_rating=d1.computed_rating,
                driver_2_rating=d2.computed_rating,
                reserve_rating=reserve.computed_rating,
                constructor_rating=constructor.computed_rating,
                engine_rating=engine.computed_rating,
                tp_rating=tp.computed_rating,
                td_rating=td.computed_rating,
                engineer_rating=eng.computed_rating,
                driver_1=_to_entity_ref(d1),
                driver_2=_to_entity_ref(d2),
                reserve=_to_entity_ref(reserve),
                constructor_slug=constructor.slug,
                engine_slug=engine.slug,
                tp_slug=tp.slug,
                engineer_slug=eng.slug,
                team_name=team_name,
            )
        )

    return rivals
