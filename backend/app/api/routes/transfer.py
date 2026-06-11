"""Transfer window — fetch candidates for a roster slot, filtered by rating proximity."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.common import RosterEntity, SlotId
from app.services.pools import _query_pool

router = APIRouter()

SLOT_TO_ASSIGNABLE: dict[str, list[str]] = {
    "driver_1": ["driver_1", "driver_2", "reserve_driver"],
    "driver_2": ["driver_1", "driver_2", "reserve_driver"],
    "reserve_driver": ["driver_1", "driver_2", "reserve_driver"],
    "constructor": ["constructor"],
    "engine": ["engine"],
    "team_principal": ["team_principal"],
    "technical_director": ["technical_director"],
    "lead_engineer": ["lead_engineer"],
    "title_sponsor": ["title_sponsor"],
    "secondary_sponsor": ["secondary_sponsor"],
    "livery_style": ["livery_style"],
    "team_motto": ["team_motto"],
}

RATING_FLOOR = 0.0
RATING_CEILING = 0.90


def _to_display_rating(internal: float | None) -> int:
    if internal is None:
        return 0
    clamped = max(RATING_FLOOR, min(RATING_CEILING, internal))
    return round((clamped - RATING_FLOOR) / (RATING_CEILING - RATING_FLOOR) * 100)


@router.get("/transfer/candidates", response_model=list[RosterEntity])
def transfer_candidates(
    slot_id: SlotId = Query(...),
    current_rating: float = Query(0.5),
    exclude_ids: list[str] = Query(default_factory=list),
    limit: int = Query(12, ge=1, le=40),
    db: Session = Depends(get_db),
) -> list[RosterEntity]:
    """Return top candidates for a transfer slot, sorted by rating proximity."""
    entities, entity_type = _query_pool(db, slot_id, exclude_ids)

    current_display = _to_display_rating(current_rating)

    def _proximity(e: "RosterEntity | object") -> float:
        rating = getattr(e, "computed_rating", None)
        disp = _to_display_rating(rating)
        return abs(disp - current_display)

    # Sort by proximity first, then by rating descending as tiebreaker
    entities.sort(key=lambda e: (_proximity(e), -(e.computed_rating or 0)))

    # Build RosterEntity output with assignable_slots filled in
    assignable = SLOT_TO_ASSIGNABLE.get(slot_id, [slot_id])
    result: list[RosterEntity] = []
    for e in entities[:limit]:
        result.append(
            RosterEntity(
                id=e.id,
                slug=e.slug,
                display_name=e.display_name,
                entity_type=e.entity_type,
                nationality=e.nationality,
                peak_year=e.peak_year,
                stats_summary=e.stats_summary,
                computed_rating=e.computed_rating,
                portrait_path=e.portrait_path,
                accent_color=e.accent_color,
                assignable_slots=assignable,
            )
        )
    return result
