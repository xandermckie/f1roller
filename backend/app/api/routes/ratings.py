"""Global entity ratings endpoint — all drivers, constructors, engines, personnel."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.constructor import Constructor
from app.models.driver import Driver
from app.models.engine_entity import EngineEntity
from app.models.personnel import Personnel

router = APIRouter()

RATING_FLOOR = 0.0
RATING_CEILING = 0.90


def _safe_stats(stats_json: dict | None) -> dict:
    return stats_json if isinstance(stats_json, dict) else {}


def _display(internal: float | None) -> int:
    if internal is None:
        return 0
    clamped = max(RATING_FLOOR, min(RATING_CEILING, internal))
    return round((clamped - RATING_FLOOR) / (RATING_CEILING - RATING_FLOOR) * 100)


class RatedEntity(BaseModel):
    id: str
    slug: str
    display_name: str
    entity_type: str
    sub_type: str | None = None
    nationality: str | None = None
    peak_year: int | None = None
    display_rating: int
    wins: int = 0
    poles: int = 0
    championships: int = 0
    avg_finish: float | None = None
    portrait_path: str | None = None


class RatingsResponse(BaseModel):
    drivers: list[RatedEntity]
    constructors: list[RatedEntity]
    engines: list[RatedEntity]
    personnel: list[RatedEntity]


@router.get("/ratings", response_model=RatingsResponse)
def get_ratings(
    db: Session = Depends(get_db),
    search: str = Query("", description="Filter by name"),
) -> RatingsResponse:
    q = search.lower().strip()

    drivers_q = db.query(Driver).filter(Driver.computed_rating > 0)
    drivers = sorted(drivers_q.all(), key=lambda d: d.computed_rating, reverse=True)
    if q:
        drivers = [d for d in drivers if q in d.display_name.lower()]

    constructors_q = db.query(Constructor)
    constructors = sorted(constructors_q.all(), key=lambda c: c.computed_rating, reverse=True)
    if q:
        constructors = [c for c in constructors if q in c.display_name.lower()]

    engines_q = db.query(EngineEntity)
    engines = sorted(engines_q.all(), key=lambda e: e.computed_rating, reverse=True)
    if q:
        engines = [e for e in engines if q in e.display_name.lower()]

    personnel_q = db.query(Personnel)
    personnel = sorted(personnel_q.all(), key=lambda p: p.computed_rating, reverse=True)
    if q:
        personnel = [p for p in personnel if q in p.display_name.lower()]

    return RatingsResponse(
        drivers=[
            RatedEntity(
                id=str(d.id),
                slug=d.slug,
                display_name=d.display_name,
                entity_type="driver",
                nationality=d.nationality,
                peak_year=d.peak_year,
                display_rating=_display(d.computed_rating),
                wins=int(_safe_stats(d.stats_json).get("wins", 0)),
                poles=int(_safe_stats(d.stats_json).get("poles", 0)),
                championships=int(_safe_stats(d.stats_json).get("championships", 0)),
                avg_finish=_safe_stats(d.stats_json).get("avg_finish"),
                portrait_path=d.portrait_path,
            )
            for d in drivers
        ],
        constructors=[
            RatedEntity(
                id=str(c.id),
                slug=c.slug,
                display_name=c.display_name,
                entity_type="constructor",
                peak_year=c.peak_year,
                display_rating=_display(c.computed_rating),
                wins=int(_safe_stats(c.stats_json).get("wins", 0)),
                poles=int(_safe_stats(c.stats_json).get("poles", 0)),
                championships=int(_safe_stats(c.stats_json).get("championships", 0)),
            )
            for c in constructors
        ],
        engines=[
            RatedEntity(
                id=str(e.id),
                slug=e.slug,
                display_name=e.display_name,
                entity_type="engine",
                peak_year=e.peak_year,
                display_rating=_display(e.computed_rating),
                wins=int(_safe_stats(e.stats_json).get("wins", 0)),
            )
            for e in engines
        ],
        personnel=[
            RatedEntity(
                id=str(p.id),
                slug=p.slug,
                display_name=p.display_name,
                entity_type="personnel",
                sub_type=p.role,
                display_rating=_display(p.computed_rating),
                championships=int(_safe_stats(p.stats_json).get("championships", 0)),
            )
            for p in personnel
        ],
    )
