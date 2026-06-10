"""Build TeamEntities from TeamPayload."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.roster_entry import RosterEntry
from app.schemas.common import TeamPayload
from app.services.synergy import EntityRef
from app.services.team_pace import TeamEntities


def _load_entry(db: Session, entity_id: str) -> RosterEntry:
    return db.query(RosterEntry).filter(RosterEntry.id == UUID(entity_id)).one()


def _driver_ref(entry: RosterEntry) -> EntityRef:
    return EntityRef(
        entry.slug,
        entry.display_name,
        entry.peak_year,
        entry.teams_history or [],
    )


def build_user_team(db: Session, payload: TeamPayload) -> TeamEntities:
    d1 = _load_entry(db, payload.driver_1_id)
    d2 = _load_entry(db, payload.driver_2_id)
    reserve = _load_entry(db, payload.reserve_driver_id)
    chassis = _load_entry(db, payload.constructor_id)
    engine = _load_entry(db, payload.engine_id)
    tp = _load_entry(db, payload.team_principal_id)
    td = _load_entry(db, payload.technical_director_id)
    eng = _load_entry(db, payload.lead_engineer_id)
    title = _load_entry(db, payload.title_sponsor_id)

    team_name = f"{title.display_name} {chassis.display_name}"

    return TeamEntities(
        driver_1_rating=d1.computed_rating,
        driver_2_rating=d2.computed_rating,
        reserve_rating=reserve.computed_rating,
        constructor_rating=chassis.computed_rating,
        engine_rating=engine.computed_rating,
        tp_rating=tp.computed_rating,
        td_rating=td.computed_rating,
        engineer_rating=eng.computed_rating,
        driver_1=_driver_ref(d1),
        driver_2=_driver_ref(d2),
        reserve=_driver_ref(reserve),
        constructor_slug=chassis.slug,
        engine_slug=engine.slug,
        tp_slug=tp.slug,
        engineer_slug=eng.slug,
        team_name=team_name,
    )
