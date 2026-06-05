"""Compute team pace from entity ratings and synergy."""

from __future__ import annotations

from dataclasses import dataclass

from app.services.synergy import EntityRef, compute_synergy, synergy_multiplier


@dataclass
class TeamEntities:
    driver_1_rating: float
    driver_2_rating: float
    reserve_rating: float
    constructor_rating: float
    engine_rating: float
    tp_rating: float
    td_rating: float
    engineer_rating: float
    driver_1: EntityRef
    driver_2: EntityRef
    reserve: EntityRef
    constructor_slug: str
    engine_slug: str
    tp_slug: str
    engineer_slug: str
    team_name: str = "Your Team"


def compute_driver_pace(d1: float, d2: float, reserve: float) -> float:
    return 1.00 * d1 + 0.88 * d2 + 0.15 * reserve


def compute_team_pace(entities: TeamEntities) -> tuple[float, float, list]:
    driver_pace = compute_driver_pace(
        entities.driver_1_rating,
        entities.driver_2_rating,
        entities.reserve_rating,
    )
    base_pace = (
        0.30 * entities.constructor_rating
        + 0.22 * entities.engine_rating
        + 0.38 * driver_pace
        + 0.06 * entities.tp_rating
        + 0.04 * entities.td_rating
        + 0.10 * entities.engineer_rating
    )
    synergy_total, synergy_details = compute_synergy(
        entities.driver_1,
        entities.driver_2,
        entities.reserve,
        entities.constructor_slug,
        entities.engine_slug,
        entities.tp_slug,
        entities.engineer_slug,
    )
    pace = base_pace * synergy_multiplier(synergy_total)
    return pace, base_pace, synergy_details
