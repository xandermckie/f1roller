#!/usr/bin/env python3
"""Import f1roller_roster_master.csv into roster_entries."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal, init_db  # noqa: E402
from app.models.roster_entry import RosterEntry  # noqa: E402
from app.services.roster_import import import_roster_master  # noqa: E402


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        count = import_roster_master(db)
        print(f"Imported {count} roster entries ({db.query(RosterEntry).count()} in database)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
