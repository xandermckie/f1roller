from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.constructor import Constructor
from app.models.driver import Driver
from app.models.engine_entity import EngineEntity
from app.models.personnel import Personnel
from app.schemas.common import EntityDetail

router = APIRouter()


@router.get("/entities/{entity_id}", response_model=EntityDetail)
def entity_detail(entity_id: str, db: Session = Depends(get_db)) -> EntityDetail:
    try:
        uid = UUID(entity_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid entity ID") from exc

    for model, entity_type in [
        (Driver, "driver"),
        (Constructor, "constructor"),
        (EngineEntity, "engine"),
        (Personnel, "personnel"),
    ]:
        row = db.query(model).filter(model.id == uid).first()
        if row:
            return EntityDetail(
                id=str(row.id),
                slug=row.slug,
                display_name=row.display_name,
                entity_type=entity_type,
                computed_rating=row.computed_rating,
                era_factor=row.era_factor,
                stats_json=row.stats_json,
                rating_breakdown={"computed_rating": row.computed_rating},
            )

    raise HTTPException(status_code=404, detail="Entity not found")
