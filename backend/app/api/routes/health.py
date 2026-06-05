from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.scrape_cache import ScrapeCache
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    cache_age_hours: float | None = None
    latest = db.query(func.max(ScrapeCache.fetched_at)).scalar()
    if latest:
        if latest.tzinfo is None:
            latest = latest.replace(tzinfo=timezone.utc)
        cache_age_hours = (datetime.now(timezone.utc) - latest).total_seconds() / 3600

    try:
        from sqlalchemy import text

        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return HealthResponse(status="ok", db=db_status, cache_age_hours=cache_age_hours)
