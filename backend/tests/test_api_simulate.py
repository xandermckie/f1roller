import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def seeded_db(db_session):
    seed_path = ROOT / "backend" / "data" / "mvp_seed.json"
    with seed_path.open(encoding="utf-8") as f:
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

    for item in data["drivers"][:5]:
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

    for item in data["constructors"][:3]:
        db_session.add(
            Constructor(
                slug=item["slug"],
                display_name=item["display_name"],
                peak_year=item["peak_year"],
                stats_json=item["stats"],
                computed_rating=0.7,
            )
        )

    for item in data["engines"][:3]:
        db_session.add(
            EngineEntity(
                slug=item["slug"],
                display_name=item["display_name"],
                peak_year=item["peak_year"],
                stats_json=item["stats"],
                computed_rating=0.7,
            )
        )

    for item in data["personnel"][:6]:
        db_session.add(
            Personnel(
                slug=item["slug"],
                display_name=item["display_name"],
                role=item["role"],
                stats_json=item["stats"],
                computed_rating=0.7,
            )
        )

    for item in data["sponsors"][:4]:
        db_session.add(
            Sponsor(
                slug=item["slug"],
                display_name=item["display_name"],
                tier=item["tier"],
            )
        )

    db_session.commit()
    return db_session


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_roll_returns_entity(client, seeded_db):
    response = client.post("/api/roll", json={"slot_id": "driver_1", "excluded_ids": []})
    assert response.status_code == 200
    data = response.json()
    assert "display_name" in data
    assert data["entity_type"] == "driver"


def test_simulate_invalid_uuid_422(client, seeded_db):
    response = client.post(
        "/api/simulate",
        json={
            "team": {
                "driver_1_id": "not-a-uuid",
                "driver_2_id": "not-a-uuid",
                "reserve_driver_id": "not-a-uuid",
                "constructor_id": "not-a-uuid",
                "engine_id": "not-a-uuid",
                "team_principal_id": "not-a-uuid",
                "technical_director_id": "not-a-uuid",
                "lead_engineer_id": "not-a-uuid",
                "title_sponsor_id": "not-a-uuid",
                "secondary_sponsor_id": "not-a-uuid",
            },
            "session_seed": "test",
        },
    )
    assert response.status_code == 422
