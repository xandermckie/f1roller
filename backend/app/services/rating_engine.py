"""Era-adjusted entity rating calculations."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any


@dataclass
class PoolMaxima:
    max_wins: float = 1.0
    max_poles: float = 1.0


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def norm_wins(wins: int, pool_max: float) -> float:
    if pool_max <= 0:
        return 0.0
    return min(1.0, wins / pool_max)


def norm_poles(poles: int, pool_max: float) -> float:
    if pool_max <= 0:
        return 0.0
    return min(1.0, poles / pool_max)


def norm_finish(avg_finish: float) -> float:
    return clamp(1.0 - ((avg_finish - 1.0) / 19.0), 0.0, 1.0)


def era_factor_driver(peak_year: int, current_year: int = 2026) -> float:
    years_since_peak = current_year - peak_year
    return clamp(0.55, 1.10 - 0.020 * years_since_peak, 1.10)


def era_factor_personnel(peak_year: int, current_year: int = 2026) -> float:
    years_since_peak = current_year - peak_year
    return clamp(0.55, 1.10 - 0.015 * years_since_peak, 1.10)


def experience_curve(gp_starts: int) -> float:
    if gp_starts <= 0:
        return 0.7
    return min(1.0, 0.7 + 0.03 * math.log10(gp_starts))


def compute_driver_rating(
    stats: dict[str, Any],
    peak_year: int,
    pool_max: PoolMaxima,
    current_year: int = 2026,
) -> tuple[float, dict[str, float]]:
    wins = int(stats.get("wins", 0))
    poles = int(stats.get("poles", 0))
    avg_finish = float(stats.get("avg_finish", 10.0))
    gp_starts = int(stats.get("gp_starts", 0))

    nw = norm_wins(wins, pool_max.max_wins)
    np_ = norm_poles(poles, pool_max.max_poles)
    nf = norm_finish(avg_finish)

    driver_base = 0.40 * nw + 0.30 * np_ + 0.30 * nf
    ef = era_factor_driver(peak_year, current_year)
    ec = experience_curve(gp_starts)
    rating = driver_base * ef * ec

    breakdown = {
        "norm_wins": nw,
        "norm_poles": np_,
        "norm_finish": nf,
        "driver_base": driver_base,
        "era_factor": ef,
        "experience_curve": ec,
    }
    return rating, breakdown


def compute_constructor_rating(
    stats: dict[str, Any],
    peak_year: int,
    pool_max: PoolMaxima,
    current_year: int = 2026,
) -> tuple[float, dict[str, float]]:
    wins = int(stats.get("wins", 0))
    poles = int(stats.get("poles", 0))
    avg_finish = float(stats.get("avg_finish", 10.0))

    nw = norm_wins(wins, pool_max.max_wins)
    np_ = norm_poles(poles, pool_max.max_poles)
    nf = norm_finish(avg_finish)

    base = 0.50 * nw + 0.30 * np_ + 0.20 * nf
    ef = era_factor_driver(peak_year, current_year)
    rating = base * ef

    return rating, {"norm_wins": nw, "norm_poles": np_, "norm_finish": nf, "era_factor": ef}


def compute_engine_rating(
    stats: dict[str, Any],
    peak_year: int,
    pool_max: PoolMaxima,
    current_year: int = 2026,
) -> tuple[float, dict[str, float]]:
    return compute_constructor_rating(stats, peak_year, pool_max, current_year)


def compute_personnel_rating(
    stats: dict[str, Any],
    peak_year: int,
    current_year: int = 2026,
) -> tuple[float, dict[str, float]]:
    team_success = float(stats.get("team_success", 0.5))
    championships = int(stats.get("championships", 0))
    ch_norm = min(1.0, championships / 10.0)
    base = 0.60 * team_success + 0.40 * ch_norm
    ef = era_factor_personnel(peak_year, current_year)
    rating = base * ef
    return rating, {"team_success": team_success, "championships_norm": ch_norm, "era_factor": ef}


def recompute_pool_maxima(entities: list[dict[str, Any]]) -> PoolMaxima:
    max_wins = max((int(e.get("stats", {}).get("wins", 0)) for e in entities), default=1)
    max_poles = max((int(e.get("stats", {}).get("poles", 0)) for e in entities), default=1)
    return PoolMaxima(max_wins=float(max(max_wins, 1)), max_poles=float(max(max_poles, 1)))
