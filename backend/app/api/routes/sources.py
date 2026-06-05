from fastapi import APIRouter

from app.schemas.common import SourceMeta

router = APIRouter()


@router.get("/sources", response_model=list[SourceMeta])
def sources() -> list[SourceMeta]:
    return [
        SourceMeta(
            name="OpenF1",
            url="https://openf1.org/",
            description="2026 calendar, circuit metadata, and current-season context.",
        ),
        SourceMeta(
            name="StatsF1",
            url="https://www.statsf1.com/",
            description="Historical driver, constructor, and engine statistics (scraped with caching).",
        ),
        SourceMeta(
            name="Wikipedia",
            url="https://en.wikipedia.org/wiki/List_of_Formula_One_driver_records",
            description="Driver records and gap-fill for missing entities.",
        ),
        SourceMeta(
            name="Wikimedia Commons",
            url="https://commons.wikimedia.org/",
            description="License-safe portraits and circuit maps where available.",
        ),
    ]
