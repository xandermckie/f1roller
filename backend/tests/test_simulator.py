from app.services.simulator import POINTS_TABLE, seeded_rng, simulate_season
from app.services.synergy import EntityRef
from app.services.team_pace import TeamEntities


def _make_team(name: str, pace_rating: float) -> TeamEntities:
    return TeamEntities(
        driver_1_rating=pace_rating,
        driver_2_rating=pace_rating * 0.9,
        reserve_rating=pace_rating * 0.5,
        constructor_rating=pace_rating * 0.8,
        engine_rating=pace_rating * 0.8,
        tp_rating=0.6,
        td_rating=0.6,
        engineer_rating=0.7,
        driver_1=EntityRef("d1", "Driver One", 2020, []),
        driver_2=EntityRef("d2", "Driver Two", 2020, []),
        reserve=EntityRef("d3", "Reserve", 2020, []),
        constructor_slug="ferrari",
        engine_slug="ferrari",
        tp_slug="toto-wolff",
        engineer_slug="adrian-newey",
        team_name=name,
    )


def test_points_table_length():
    assert len(POINTS_TABLE) == 10
    assert POINTS_TABLE[0] == 25


def test_seeded_rng_deterministic():
    r1 = seeded_rng("seed-abc", "race-1")
    r2 = seeded_rng("seed-abc", "race-1")
    assert r1.random() == r2.random()


def test_simulate_produces_races():
    user = _make_team("User Team", 0.9)
    rivals = [_make_team(f"Rival {i}", 0.5 + i * 0.02) for i in range(19)]
    calendar = [
        type("R", (), {
            "round_number": i,
            "meeting_key": 1000 + i,
            "meeting_name": f"GP {i}",
            "circuit_short_name": "Test",
            "circuit_key": i,
        })()
        for i in range(1, 4)
    ]
    result = simulate_season(user, rivals, calendar, "test-seed")
    assert len(result.races) == 3
    assert len(result.final_wdc) > 0
    assert result.session_seed == "test-seed"


def test_same_seed_same_result():
    user = _make_team("User", 0.85)
    rivals = [_make_team(f"R{i}", 0.6) for i in range(19)]
    calendar = [
        type("R", (), {
            "round_number": 1,
            "meeting_key": 1,
            "meeting_name": "Bahrain GP",
            "circuit_short_name": "Sakhir",
            "circuit_key": 63,
        })()
    ]
    r1 = simulate_season(user, rivals, calendar, "fixed")
    r2 = simulate_season(user, rivals, calendar, "fixed")
    assert r1.races[0].user_race_points == r2.races[0].user_race_points
