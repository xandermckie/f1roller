"""Build TeamEntities from TeamPayload."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.constructor import Constructor
from app.models.driver import Driver
from app.models.engine_entity import EngineEntity
from app.models.personnel import Personnel
from app.models.sponsor import Sponsor
from app.schemas.common import TeamPayload
from app.services.synergy import EntityRef
from app.services.team_pace import TeamEntities


def _driver_ref(d: Driver) -> EntityRef:
    return EntityRef(d.slug, d.display_name, d.peak_year, d.teams_history or [])


def build_user_team(db: Session, payload: TeamPayload) -> TeamEntities:
    d1 = db.query(Driver).filter(Driver.id == UUID(payload.driver_1_id)).one()
    d2 = db.query(Driver).filter(Driver.id == UUID(payload.driver_2_id)).one()
    reserve = db.query(Driver).filter(Driver.id == UUID(payload.reserve_driver_id)).one()
    constructor = db.query(Constructor).filter(Constructor.id == UUID(payload.constructor_id)).one()
    engine = db.query(EngineEntity).filter(EngineEntity.id == UUID(payload.engine_id)).one()
    tp = db.query(Personnel).filter(Personnel.id == UUID(payload.team_principal_id)).one()
    td = db.query(Personnel).filter(Personnel.id == UUID(payload.technical_director_id)).one()
    eng = db.query(Personnel).filter(Personnel.id == UUID(payload.lead_engineer_id)).one()

    title = db.query(Sponsor).filter(Sponsor.id == UUID(payload.title_sponsor_id)).first()
    team_name = f"{title.display_name if title else constructor.display_name} {constructor.display_name}"

    return TeamEntities(
        driver_1_rating=d1.computed_rating,
        driver_2_rating=d2.computed_rating,
        reserve_rating=reserve.computed_rating,
        constructor_rating=constructor.computed_rating,
        engine_rating=engine.computed_rating,
        tp_rating=tp.computed_rating,
        td_rating=td.computed_rating,
        engineer_rating=eng.computed_rating,
        driver_1=_driver_ref(d1),
        driver_2=_driver_ref(d2),
        reserve=_driver_ref(reserve),
        constructor_slug=constructor.slug,
        engine_slug=engine.slug,
        tp_slug=tp.slug,
        engineer_slug=eng.slug,
        team_name=team_name,
    )
