"""Parse f1roller_roster_master.csv into typed rows and ratings."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.rating_engine import (
    PoolMaxima,
    compute_constructor_rating,
    compute_driver_rating,
    compute_engine_rating,
    compute_personnel_rating,
    era_factor_driver,
    era_factor_personnel,
)

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "f1roller_roster_master.csv"

PERSONNEL_ROLES = frozenset({"team_principal", "technical_director", "lead_engineer"})


@dataclass(frozen=True)
class RosterCsvRow:
    team_slug: str
    decade: str
    entity_type: str
    slug: str
    display_name: str
    nationality: str | None
    career_start_year: int | None
    career_end_year: int | None
    peak_year: int | None
    personnel_role: str | None
    sponsor_tier: str | None
    accent_color: str | None
    motto_text: str | None
    teams_history: list[str]
    source_url: str | None
    data_quality: str | None
    stats_json: dict[str, Any]


def parse_int(value: str | None) -> int | None:
    if not value or not value.strip():
        return None
    return int(float(value))


def parse_float(value: str | None) -> float | None:
    if not value or not value.strip():
        return None
    return float(value)


def parse_teams_history(value: str | None) -> list[str]:
    if not value or not value.strip():
        return []
    return [part.strip() for part in value.split("|") if part.strip()]


def infer_personnel_role(row: dict[str, str]) -> str | None:
    role = (row.get("personnel_role") or "").strip()
    if role in PERSONNEL_ROLES:
        return role

    slug = row.get("slug", "")
    if slug.endswith("-tp") or "-tp-" in slug or slug.endswith("-tp60s"):
        return "team_principal"
    if "-le" in slug or slug.endswith("-le00s"):
        return "lead_engineer"
    if "-td" in slug:
        return "technical_director"

    notes = (row.get("notes") or "").lower()
    if "lead_engineer" in notes or "lead engineer" in notes:
        return "lead_engineer"
    if "technical_director" in notes or "chief designer" in notes:
        return "technical_director"
    if "team_principal" in notes:
        return "team_principal"
    return None


def row_to_stats(raw: dict[str, str], entity_type: str) -> dict[str, Any]:
    if entity_type == "driver":
        return {
            "gp_starts": parse_int(raw.get("gp_starts")) or 0,
            "wins": parse_int(raw.get("wins")) or 0,
            "poles": parse_int(raw.get("poles")) or 0,
            "podiums": parse_int(raw.get("podiums")) or 0,
            "avg_finish": parse_float(raw.get("avg_finish")) or 10.0,
            "championships": parse_int(raw.get("championships")) or 0,
        }
    if entity_type in ("engine", "chassis"):
        return {
            "wins": parse_int(raw.get("wins")) or 0,
            "poles": parse_int(raw.get("poles")) or 0,
            "avg_finish": parse_float(raw.get("avg_finish")) or 10.0,
            "starts": parse_int(raw.get("starts")) or 0,
        }
    if entity_type == "personnel":
        return {
            "team_success": parse_float(raw.get("team_success")) or 0.5,
            "championships": parse_int(raw.get("championships")) or 0,
        }
    return {}


def compute_row_rating(
    entity_type: str,
    stats: dict[str, Any],
    peak_year: int | None,
    pool_max: PoolMaxima,
) -> float:
    year = peak_year or 1980
    if entity_type == "driver":
        rating, _ = compute_driver_rating(stats, year, pool_max)
        return rating
    if entity_type == "chassis":
        rating, _ = compute_constructor_rating(stats, year, pool_max)
        return rating if rating > 0 else 0.65
    if entity_type == "engine":
        rating, _ = compute_engine_rating(stats, year, pool_max)
        return rating if rating > 0 else 0.65
    if entity_type == "personnel":
        rating, _ = compute_personnel_rating(stats, year)
        return rating
    if entity_type == "sponsor":
        return 0.5
    if entity_type in ("livery", "motto"):
        return 0.5
    return 0.5


def parse_csv_row(raw: dict[str, str]) -> RosterCsvRow:
    entity_type = raw["entity_type"].strip()
    personnel_role = infer_personnel_role(raw) if entity_type == "personnel" else None
    stats = row_to_stats(raw, entity_type)

    return RosterCsvRow(
        team_slug=raw["team_slug"].strip(),
        decade=raw["decade"].strip(),
        entity_type=entity_type,
        slug=raw["slug"].strip(),
        display_name=raw["display_name"].strip(),
        nationality=(raw.get("nationality") or "").strip() or None,
        career_start_year=parse_int(raw.get("career_start_year")),
        career_end_year=parse_int(raw.get("career_end_year")),
        peak_year=parse_int(raw.get("peak_year")),
        personnel_role=personnel_role,
        sponsor_tier=(raw.get("sponsor_tier") or "").strip() or None,
        accent_color=(raw.get("accent_color") or "").strip() or None,
        motto_text=(raw.get("motto_text") or "").strip() or None,
        teams_history=parse_teams_history(raw.get("teams_history")),
        source_url=(raw.get("source_url") or "").strip() or None,
        data_quality=(raw.get("data_quality") or "").strip() or None,
        stats_json=stats,
    )


def load_roster_csv(path: Path | None = None) -> list[RosterCsvRow]:
    csv_path = path or CSV_PATH
    with csv_path.open(encoding="utf-8", newline="") as handle:
        return [parse_csv_row(row) for row in csv.DictReader(handle)]


def driver_pool_maxima(rows: list[RosterCsvRow]) -> PoolMaxima:
    drivers = [r for r in rows if r.entity_type == "driver"]
    max_wins = max((int(r.stats_json.get("wins", 0)) for r in drivers), default=1)
    max_poles = max((int(r.stats_json.get("poles", 0)) for r in drivers), default=1)
    return PoolMaxima(max_wins=float(max(max_wins, 1)), max_poles=float(max(max_poles, 1)))


def compute_era_factor(entity_type: str, peak_year: int | None) -> float:
    year = peak_year or 1980
    if entity_type == "personnel":
        return era_factor_personnel(year)
    if entity_type in ("driver", "engine", "chassis"):
        return era_factor_driver(year)
    return 1.0
