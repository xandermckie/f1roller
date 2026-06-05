"""Precompute benchmark team — run via cron."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal, init_db  # noqa: E402
from app.services.benchmark import compute_benchmark, save_benchmark  # noqa: E402


def main() -> None:
    init_db()
    db = SessionLocal()
    payload, pace, _ = compute_benchmark(db)
    save_benchmark(db, payload, pace)
    print(f"Benchmark team pace: {pace:.4f}")
    db.close()


if __name__ == "__main__":
    main()
