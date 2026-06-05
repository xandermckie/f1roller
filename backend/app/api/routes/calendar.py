from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.schemas.common import CalendarEventOut
from app.services.openf1 import fallback_calendar_2026, get_calendar

router = APIRouter()


@router.get("/calendar", response_model=list[CalendarEventOut])
def calendar(year: int | None = None, db: Session = Depends(get_db)) -> list[CalendarEventOut]:
    target_year = year or settings.sim_season_year
    events = get_calendar(db, target_year)
    if not events:
        events = fallback_calendar_2026(db)
    return [CalendarEventOut.model_validate(e) for e in events]
