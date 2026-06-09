import json
from pathlib import Path

import pytest

from app.services.roster_builder import build_roster, roll_decade, roll_team

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
                nationality=item.get("nationality"),
                career_start_year=item.get("career_start_year"),
                career_end_year=item.get("career_end_year"),
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
                peak_year=item["peak_year"],
                teams_history=item.get("teams", []),
                stats_json=item["stats"],
                computed_rating=0.7,
            )
        )

    for item in data["sponsors"]:
        db_session.add(
            Sponsor(
                slug=item["slug"],
                display_name=item["display_name"],
                tier=item["tier"],
                accent_color=item.get("accent_color"),
            )
        )

    db_session.commit()
    return db_session


def test_mclaren_1980s_includes_senna_prost(full_seed):
    roster = build_roster(full_seed, "mclaren", "1980s")
    driver_slugs = {e.slug for e in roster.entities if e.entity_type == "driver"}
    assert "ayrton-senna" in driver_slugs
    assert "alain-prost" in driver_slugs
    assert roster.team_display_name == "McLaren"


def test_personnel_filtered_by_team(full_seed):
    roster = build_roster(full_seed, "mclaren", "1980s")
    personnel_slugs = {e.slug for e in roster.entities if e.entity_type == "personnel"}
    assert "ron-dennis" in personnel_slugs
    assert "toto-wolff" not in personnel_slugs


def test_personnel_assignable_slots_match_role(full_seed):
    roster = build_roster(full_seed, "ferrari", "2000s")
    for entity in roster.entities:
        if entity.entity_type == "personnel":
            if entity.role_label == "Team Principal":
                assert entity.assignable_slots == ["team_principal"]
            elif entity.role_label == "Technical Director":
                assert entity.assignable_slots == ["technical_director"]
            elif entity.role_label == "Lead Engineer":
                assert entity.assignable_slots == ["lead_engineer"]


def test_thin_combo_still_returns_roster(full_seed):
    roster = build_roster(full_seed, "cadillac", "1960s")
    assert roster.team_slug == "cadillac"
    assert len(roster.entities) > 0


def test_roll_team_and_decade_are_deterministic(full_seed):
    team_a, _ = roll_team(full_seed, "seed-1")
    team_b, _ = roll_team(full_seed, "seed-1")
    assert team_a == team_b

    decade_a = roll_decade("seed-1")
    decade_b = roll_decade("seed-1")
    assert decade_a == decade_b

    team_reroll, _ = roll_team(full_seed, "seed-1", reroll_salt="reroll-1")
    decade_reroll = roll_decade("seed-1", reroll_salt="reroll-1")
    assert team_reroll != team_a or decade_reroll != decade_a


def test_roster_api(client, full_seed):
    roll_resp = client.post(
        "/api/roster/roll-team",
        json={"session_seed": "api-test"},
    )
    assert roll_resp.status_code == 200
    team = roll_resp.json()

    decade_resp = client.post(
        "/api/roster/roll-decade",
        json={"session_seed": "api-test"},
    )
    assert decade_resp.status_code == 200
    decade = decade_resp.json()["decade"]

    roster_resp = client.get(
        f"/api/roster?team_slug={team['slug']}&decade={decade}",
    )
    assert roster_resp.status_code == 200
    body = roster_resp.json()
    assert body["team_slug"] == team["slug"]
    assert body["decade"] == decade
    assert len(body["entities"]) > 0
