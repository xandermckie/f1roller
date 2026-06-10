"""Build 2026 real-grid rival teams from roster_entries."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.real_grid import RealGridEntry
from app.models.roster_entry import RosterEntry
from app.services.synergy import EntityRef
from app.services.team_pace import TeamEntities


def _best_entry(
    entries: list[RosterEntry],
    *,
    entity_type: str,
    personnel_role: str | None = None,
) -> RosterEntry | None:
    filtered = [
        entry
        for entry in entries
        if entry.entity_type == entity_type
        and (personnel_role is None or entry.personnel_role == personnel_role)
    ]
    if not filtered:
        return None
    return max(filtered, key=lambda entry: entry.computed_rating)


def _to_ref(entry: RosterEntry) -> EntityRef:
    return EntityRef(
        slug=entry.slug,
        display_name=entry.display_name,
        peak_year=entry.peak_year,
        teams_history=entry.teams_history or [],
    )


def _team_entities_from_grid_row(
    db: Session,
    entry: RealGridEntry,
    driver: RosterEntry,
    constructor: RosterEntry,
) -> TeamEntities | None:
    team_entries = (
        db.query(RosterEntry)
        .filter(
            RosterEntry.team_slug == constructor.team_slug,
            RosterEntry.decade == constructor.decade,
        )
        .all()
    )
    engine = _best_entry(team_entries, entity_type="engine")
    tp = _best_entry(team_entries, entity_type="personnel", personnel_role="team_principal")
    td = _best_entry(team_entries, entity_type="personnel", personnel_role="technical_director")
    engineer = _best_entry(team_entries, entity_type="personnel", personnel_role="lead_engineer")
    if engineer is None:
        engineer = td
    if not all([engine, tp, td, engineer]):
        return None

    drivers = [e for e in team_entries if e.entity_type == "driver"]
    d2 = next((d for d in drivers if d.id != driver.id), driver)
    reserve = next((d for d in drivers if d.id not in {driver.id, d2.id}), d2)

    return TeamEntities(
        driver_1_rating=driver.computed_rating,
        driver_2_rating=d2.computed_rating,
        reserve_rating=reserve.computed_rating,
        constructor_rating=constructor.computed_rating,
        engine_rating=engine.computed_rating,
        tp_rating=tp.computed_rating,
        td_rating=td.computed_rating,
        engineer_rating=engineer.computed_rating,
        driver_1=_to_ref(driver),
        driver_2=_to_ref(d2),
        reserve=_to_ref(reserve),
        constructor_slug=constructor.slug,
        engine_slug=engine.slug,
        tp_slug=tp.slug,
        engineer_slug=engineer.slug,
        team_name=entry.team_name,
    )


def build_real_grid_teams(db: Session) -> list[TeamEntities]:
    entries = db.query(RealGridEntry).all()
    teams: list[TeamEntities] = []
    for row in entries:
        driver = (
            db.query(RosterEntry).filter(RosterEntry.id == row.driver_entity_id).first()
            if row.driver_entity_id
            else None
        )
        constructor = (
            db.query(RosterEntry).filter(RosterEntry.id == row.constructor_entity_id).first()
            if row.constructor_entity_id
            else None
        )
        if not driver or not constructor:
            continue
        built = _team_entities_from_grid_row(db, row, driver, constructor)
        if built:
            teams.append(built)
    return teams
