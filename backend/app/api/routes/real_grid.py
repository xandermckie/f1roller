from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.real_grid import RealGridEntry
from app.schemas.common import RealGridEntryOut

router = APIRouter()


@router.get("/real-grid/2026", response_model=list[RealGridEntryOut])
def real_grid(db: Session = Depends(get_db)) -> list[RealGridEntryOut]:
    entries = db.query(RealGridEntry).order_by(RealGridEntry.team_name).all()
    return [
        RealGridEntryOut(
            team_name=e.team_name,
            driver_number=e.driver_number,
            driver_name=e.driver_name,
            constructor_name=e.constructor_name,
        )
        for e in entries
    ]
