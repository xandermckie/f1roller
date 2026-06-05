from app.services.rating_engine import (
    PoolMaxima,
    compute_driver_rating,
    era_factor_driver,
    norm_finish,
    norm_wins,
)


def test_norm_wins_caps_at_one():
    pool = PoolMaxima(max_wins=100.0)
    assert norm_wins(50, pool.max_wins) == 0.5
    assert norm_wins(150, pool.max_wins) == 1.0


def test_norm_finish_p1_is_best():
    assert norm_finish(1.0) == 1.0
    assert norm_finish(20.0) == 0.0


def test_era_factor_decays_with_age():
    recent = era_factor_driver(2024)
    old = era_factor_driver(1980)
    assert recent > old


def test_driver_rating_increases_with_wins():
    pool = PoolMaxima(max_wins=100.0, max_poles=100.0)
    stats_low = {"wins": 5, "poles": 2, "avg_finish": 10.0, "gp_starts": 50}
    stats_high = {"wins": 50, "poles": 30, "avg_finish": 4.0, "gp_starts": 200}
    r_low, _ = compute_driver_rating(stats_low, 2010, pool)
    r_high, _ = compute_driver_rating(stats_high, 2010, pool)
    assert r_high > r_low
