#!/usr/bin/env python3
"""Seed MVP roster from JSON and compute ratings."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal, init_db  # noqa: E402
from app.models.constructor import Constructor  # noqa: E402
from app.models.driver import Driver  # noqa: E402
from app.models.engine_entity import EngineEntity  # noqa: E402
from app.services.mvp_seed import seed_mvp_roster  # noqa: E402


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed_mvp_roster(db)
        print(
            f"Seeded {db.query(Driver).count()} drivers, "
            f"{db.query(Constructor).count()} constructors, "
            f"{db.query(EngineEntity).count()} engines"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
