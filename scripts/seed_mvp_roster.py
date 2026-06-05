#!/usr/bin/env python3
"""Seed MVP roster from JSON and compute ratings."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal, init_db  # noqa: E402
from app.models.constructor import Constructor  # noqa: E402
from app.models.driver import Driver  # noqa: E402
from app.models.engine_entity import EngineEntity  # noqa: E402
from app.models.personnel import Personnel  # noqa: E402
from app.models.sponsor import Sponsor  # noqa: E402
from app.services.benchmark import compute_benchmark, save_benchmark  # noqa: E402
from app.services.openf1 import sync_real_grid  # noqa: E402
from app.services.rating_engine import (  # noqa: E402
    PoolMaxima,
    compute_constructor_rating,
    compute_driver_rating,
    compute_engine_rating,
    compute_personnel_rating,
    era_factor_driver,
    era_factor_personnel,
)


def load_seed() -> dict:
    path = ROOT / "backend" / "data" / "mvp_seed.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def seed_drivers(db, data: dict, pool_max: PoolMaxima) -> None:
    for item in data["drivers"]:
        rating, _ = compute_driver_rating(
            item["stats"], item["peak_year"], pool_max
        )
        existing = db.query(Driver).filter(Driver.slug == item["slug"]).first()
        if existing:
            continue
        db.add(
            Driver(
                slug=item["slug"],
                display_name=item["display_name"],
                nationality=item.get("nationality"),
                career_start_year=item.get("career_start_year"),
                career_end_year=item.get("career_end_year"),
                peak_year=item["peak_year"],
                stats_json=item["stats"],
                computed_rating=rating,
                era_factor=era_factor_driver(item["peak_year"]),
                teams_history=item.get("teams", []),
                data_quality="seed",
                sources=["seed"],
            )
        )
    db.commit()


def seed_constructors(db, data: dict, pool_max: PoolMaxima) -> None:
    for item in data["constructors"]:
        rating, _ = compute_constructor_rating(
            item["stats"], item["peak_year"], pool_max
        )
        if db.query(Constructor).filter(Constructor.slug == item["slug"]).first():
            continue
        db.add(
            Constructor(
                slug=item["slug"],
                display_name=item["display_name"],
                peak_year=item["peak_year"],
                stats_json=item["stats"],
                computed_rating=rating,
                era_factor=era_factor_driver(item["peak_year"]),
                data_quality="seed",
                sources=["seed"],
            )
        )
    db.commit()


def seed_engines(db, data: dict, pool_max: PoolMaxima) -> None:
    for item in data["engines"]:
        rating, _ = compute_engine_rating(item["stats"], item["peak_year"], pool_max)
        if db.query(EngineEntity).filter(EngineEntity.slug == item["slug"]).first():
            continue
        db.add(
            EngineEntity(
                slug=item["slug"],
                display_name=item["display_name"],
                peak_year=item["peak_year"],
                stats_json=item["stats"],
                computed_rating=rating,
                era_factor=era_factor_driver(item["peak_year"]),
                data_quality="seed",
                sources=["seed"],
            )
        )
    db.commit()


def seed_personnel(db, data: dict) -> None:
    for item in data["personnel"]:
        rating, _ = compute_personnel_rating(item["stats"], item["peak_year"])
        if db.query(Personnel).filter(Personnel.slug == item["slug"]).first():
            continue
        db.add(
            Personnel(
                slug=item["slug"],
                display_name=item["display_name"],
                role=item["role"],
                stats_json=item["stats"],
                computed_rating=rating,
                era_factor=era_factor_personnel(item["peak_year"]),
                data_quality="seed",
                sources=["seed"],
            )
        )
    db.commit()


def seed_sponsors(db, data: dict) -> None:
    for item in data["sponsors"]:
        if db.query(Sponsor).filter(Sponsor.slug == item["slug"]).first():
            continue
        db.add(
            Sponsor(
                slug=item["slug"],
                display_name=item["display_name"],
                tier=item["tier"],
                accent_color=item.get("accent_color", "#E10600"),
            )
        )
    db.commit()


def main() -> None:
    init_db()
    data = load_seed()
    db = SessionLocal()

    driver_pool = [{"stats": d["stats"]} for d in data["drivers"]]
    pool_max = PoolMaxima(
        max_wins=max(d["stats"]["wins"] for d in data["drivers"]),
        max_poles=max(d["stats"]["poles"] for d in data["drivers"]),
    )

    seed_drivers(db, data, pool_max)
    seed_constructors(db, data, pool_max)
    seed_engines(db, data, pool_max)
    seed_personnel(db, data)
    seed_sponsors(db, data)
    sync_real_grid(db)

    payload, pace, _ = compute_benchmark(db)
    save_benchmark(db, payload, pace)

    print(
        f"Seeded {db.query(Driver).count()} drivers, "
        f"{db.query(Constructor).count()} constructors, "
        f"{db.query(EngineEntity).count()} engines"
    )
    db.close()


if __name__ == "__main__":
    main()
