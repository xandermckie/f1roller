"""Seed MVP roster from JSON when the database is empty."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.constructor import Constructor
from app.models.driver import Driver
from app.models.engine_entity import EngineEntity
from app.models.personnel import Personnel
from app.models.sponsor import Sponsor
from app.services.benchmark import compute_benchmark, save_benchmark
from app.services.openf1 import sync_real_grid
from app.services.rating_engine import (
    PoolMaxima,
    compute_constructor_rating,
    compute_driver_rating,
    compute_engine_rating,
    compute_personnel_rating,
    era_factor_driver,
    era_factor_personnel,
)

SEED_PATH = Path(__file__).resolve().parents[2] / "data" / "mvp_seed.json"


def load_seed_data() -> dict:
    with SEED_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def seed_mvp_roster(db: Session, data: dict | None = None) -> None:
    payload = data or load_seed_data()
    pool_max = PoolMaxima(
        max_wins=max(d["stats"]["wins"] for d in payload["drivers"]),
        max_poles=max(d["stats"]["poles"] for d in payload["drivers"]),
    )

    for item in payload["drivers"]:
        if db.query(Driver).filter(Driver.slug == item["slug"]).first():
            continue
        rating, _ = compute_driver_rating(item["stats"], item["peak_year"], pool_max)
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

    for item in payload["constructors"]:
        if db.query(Constructor).filter(Constructor.slug == item["slug"]).first():
            continue
        rating, _ = compute_constructor_rating(item["stats"], item["peak_year"], pool_max)
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

    for item in payload["engines"]:
        if db.query(EngineEntity).filter(EngineEntity.slug == item["slug"]).first():
            continue
        rating, _ = compute_engine_rating(item["stats"], item["peak_year"], pool_max)
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

    for item in payload["personnel"]:
        if db.query(Personnel).filter(Personnel.slug == item["slug"]).first():
            continue
        rating, _ = compute_personnel_rating(item["stats"], item["peak_year"])
        db.add(
            Personnel(
                slug=item["slug"],
                display_name=item["display_name"],
                role=item["role"],
                peak_year=item["peak_year"],
                teams_history=item.get("teams", []),
                stats_json=item["stats"],
                computed_rating=rating,
                era_factor=era_factor_personnel(item["peak_year"]),
                data_quality="seed",
                sources=["seed"],
            )
        )
    db.commit()

    for item in payload["sponsors"]:
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

    sync_real_grid(db)
    team_payload, pace, _ = compute_benchmark(db)
    save_benchmark(db, team_payload, pace)


def backfill_personnel_from_seed(db: Session, data: dict | None = None) -> int:
    """Update existing personnel rows with peak_year and teams_history from seed."""
    payload = data or load_seed_data()
    updated = 0
    for item in payload.get("personnel", []):
        person = db.query(Personnel).filter(Personnel.slug == item["slug"]).first()
        if not person:
            continue
        changed = False
        if person.peak_year is None and item.get("peak_year") is not None:
            person.peak_year = item["peak_year"]
            changed = True
        seed_teams = item.get("teams", [])
        if seed_teams and not (person.teams_history or []):
            person.teams_history = seed_teams
            changed = True
        if changed:
            updated += 1
    if updated:
        db.commit()
    return updated


def ensure_mvp_seeded(db: Session) -> bool:
    """Seed roster data on first startup. Returns True when seeding ran."""
    if db.query(Driver).count() > 0:
        return False
    seed_mvp_roster(db)
    return True
