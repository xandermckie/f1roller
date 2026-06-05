"""Synergy bonus calculations between team entities."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EntityRef:
    slug: str
    display_name: str
    peak_year: int | None
    teams_history: list[str]


# Curated historical pairings: (slug_a, slug_b) -> bonus
ENGINE_CONSTRUCTOR_PAIRS: dict[tuple[str, str], float] = {
    ("honda", "mclaren"): 0.06,
    ("renault", "williams"): 0.05,
    ("renault", "benetton"): 0.04,
    ("mercedes", "mercedes"): 0.06,
    ("ferrari", "ferrari"): 0.05,
    ("honda", "red-bull"): 0.05,
    ("ford-cosworth", "mclaren"): 0.04,
    ("bmw", "williams"): 0.04,
    ("honda", "bar"): 0.03,
    ("renault", "red-bull"): 0.04,
}

TP_ENGINEER_PAIRS: dict[tuple[str, str], float] = {
    ("ross-brawn", "adrian-newey"): 0.03,
    ("christian-horner", "adrian-newey"): 0.03,
    ("toto-wolff", "james-allison"): 0.03,
    ("ron-dennis", "adrian-newey"): 0.03,
    ("flavio-briatore", "pat-symonds"): 0.03,
}

DRIVER_TEAMMATE_PAIRS: dict[tuple[str, str], float] = {
    ("ayrton-senna", "alain-prost"): 0.04,
    ("lewis-hamilton", "nico-rosberg"): 0.02,
    ("fernando-alonso", "lewis-hamilton"): 0.02,
}

DRIVER_TEAM_HISTORY: dict[str, list[str]] = {
    "ayrton-senna": ["lotus", "mclaren"],
    "alain-prost": ["renault", "mclaren", "ferrari", "williams"],
    "lewis-hamilton": ["mclaren", "mercedes", "ferrari"],
    "michael-schumacher": ["jordan", "benetton", "ferrari", "mercedes"],
    "fernando-alonso": ["minardi", "renault", "mclaren", "ferrari", "alpine", "aston-martin"],
    "max-verstappen": ["toro-rosso", "red-bull"],
    "lando-norris": ["mclaren"],
    "charles-leclerc": ["sauber", "ferrari"],
    "george-russell": ["williams", "mercedes"],
    "sebastian-vettel": ["bmw-sauber", "toro-rosso", "red-bull", "ferrari", "aston-martin"],
}


def _pair_key(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def lookup_pair_bonus(pairs: dict[tuple[str, str], float], a: str, b: str) -> float:
    return pairs.get(_pair_key(a, b), 0.0)


def shared_team_seasons(driver_a: EntityRef, driver_b: EntityRef) -> bool:
    teams_a = set(driver_a.teams_history or DRIVER_TEAM_HISTORY.get(driver_a.slug, []))
    teams_b = set(driver_b.teams_history or DRIVER_TEAM_HISTORY.get(driver_b.slug, []))
    return bool(teams_a & teams_b)


def compute_synergy(
    driver_1: EntityRef,
    driver_2: EntityRef,
    reserve: EntityRef,
    constructor_slug: str,
    engine_slug: str,
    tp_slug: str,
    engineer_slug: str,
) -> tuple[float, list[dict[str, float | str]]]:
    bonuses: list[dict[str, float | str]] = []
    total = 0.0

    ec_bonus = lookup_pair_bonus(ENGINE_CONSTRUCTOR_PAIRS, engine_slug, constructor_slug)
    if ec_bonus:
        bonuses.append({"label": "Engine–Constructor pairing", "value": ec_bonus})
        total += ec_bonus

    if shared_team_seasons(driver_1, driver_2):
        bonuses.append({"label": "Driver pairing history", "value": 0.02})
        total += 0.02

    legendary = lookup_pair_bonus(DRIVER_TEAMMATE_PAIRS, driver_1.slug, driver_2.slug)
    if legendary:
        bonuses.append({"label": "Legendary driver pairing", "value": legendary})
        total += legendary

    peak_1 = driver_1.peak_year or 2000
    peak_2 = driver_2.peak_year or 2000
    if abs(peak_1 - peak_2) > 20:
        bonuses.append({"label": "Era gap penalty", "value": -0.02})
        total -= 0.02

    tp_eng = lookup_pair_bonus(TP_ENGINEER_PAIRS, tp_slug, engineer_slug)
    if tp_eng:
        bonuses.append({"label": "TP–Engineer collaboration", "value": tp_eng})
        total += tp_eng

    reserve_teams = set(reserve.teams_history or DRIVER_TEAM_HISTORY.get(reserve.slug, []))
    d1_teams = set(driver_1.teams_history or DRIVER_TEAM_HISTORY.get(driver_1.slug, []))
    d2_teams = set(driver_2.teams_history or DRIVER_TEAM_HISTORY.get(driver_2.slug, []))
    if reserve_teams & (d1_teams | d2_teams):
        bonuses.append({"label": "Reserve teammate history", "value": 0.01})
        total += 0.01

    return total, bonuses


def synergy_multiplier(total_bonus: float) -> float:
    return 1.0 + total_bonus
