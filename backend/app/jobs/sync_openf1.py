"""Sync OpenF1 calendar — run via cron."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import settings  # noqa: E402
from app.db import SessionLocal, init_db  # noqa: E402
from app.services.openf1 import fetch_meetings, sync_calendar  # noqa: E402


async def main() -> None:
    init_db()
    db = SessionLocal()
    for year in [settings.sim_season_year, settings.sim_season_year - 1]:
        try:
            meetings = await fetch_meetings(year)
            count = sync_calendar(db, year, meetings)
            print(f"Synced {count} meetings for {year}")
        except Exception as exc:
            print(f"Failed to sync {year}: {exc}")
    db.close()


if __name__ == "__main__":
    asyncio.run(main())
