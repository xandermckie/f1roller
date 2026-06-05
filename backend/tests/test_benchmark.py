import json
from pathlib import Path

import pytest

from app.services.benchmark import compute_benchmark

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def full_seed(db_session):
    with (ROOT / "backend" / "data" / "mvp_seed.json").open(encoding="utf-8") as f:
        data = json.load(f)

    from app.models.constructor import Constructor
    from app.models.driver import Driver
    from app.models.engine_entity import EngineEntity
    from app.models.personnel import Personnel
    from app.models.sponsor import Sponsor
    from app.services.rating_engine import PoolMaxima, compute_driver_rating

    pool_max = PoolMaxima(
        max_wins=max(d["stats"]["wins"] for d in data["drivers"]),
        max_poles=max(d["stats"]["poles"] for d in data["drivers"]),
    )

    for item in data["drivers"]:
        rating, _ = compute_driver_rating(item["stats"], item["peak_year"], pool_max)
        db_session.add(
            Driver(
                slug=item["slug"],
                display_name=item["display_name"],
                peak_year=item["peak_year"],
                stats_json=item["stats"],
                computed_rating=rating,
                teams_history=item.get("teams", []),
            )
        )

    for item in data["constructors"]:
        db_session.add(
            Constructor(
                slug=item["slug"],
                display_name=item["display_name"],
                peak_year=item["peak_year"],
                stats_json=item["stats"],
                computed_rating=0.7,
            )
        )

    for item in data["engines"]:
        db_session.add(
            EngineEntity(
                slug=item["slug"],
                display_name=item["display_name"],
                peak_year=item["peak_year"],
                stats_json=item["stats"],
                computed_rating=0.7,
            )
        )

    for item in data["personnel"]:
        db_session.add(
            Personnel(
                slug=item["slug"],
                display_name=item["display_name"],
                role=item["role"],
                stats_json=item["stats"],
                computed_rating=0.7,
            )
        )

    for item in data["sponsors"]:
        db_session.add(
            Sponsor(slug=item["slug"], display_name=item["display_name"], tier=item["tier"])
        )

    db_session.commit()
    return db_session


def test_benchmark_completes_quickly(full_seed):
    import time

    start = time.perf_counter()
    _, pace, _ = compute_benchmark(full_seed)
    elapsed = time.perf_counter() - start
    assert pace > 0
    assert elapsed < 2.0
