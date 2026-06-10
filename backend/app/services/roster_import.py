"""Import roster master CSV into roster_entries."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.roster_entry import RosterEntry
from app.services.roster_builder import team_display_name
from app.services.roster_csv import (
    CSV_PATH,
    RosterCsvRow,
    compute_era_factor,
    compute_row_rating,
    driver_pool_maxima,
    load_roster_csv,
)


def _entry_from_row(row: RosterCsvRow, pool_max) -> RosterEntry:
    rating = compute_row_rating(row.entity_type, row.stats_json, row.peak_year, pool_max)
    return RosterEntry(
        team_slug=row.team_slug,
        decade=row.decade,
        entity_type=row.entity_type,
        slug=row.slug,
        display_name=row.display_name,
        nationality=row.nationality,
        career_start_year=row.career_start_year,
        career_end_year=row.career_end_year,
        peak_year=row.peak_year,
        personnel_role=row.personnel_role,
        sponsor_tier=row.sponsor_tier,
        accent_color=row.accent_color,
        motto_text=row.motto_text,
        teams_history=row.teams_history,
        stats_json=row.stats_json,
        computed_rating=rating,
        era_factor=compute_era_factor(row.entity_type, row.peak_year),
        source_url=row.source_url,
        data_quality=row.data_quality,
    )


def _backfill_gaps(rows: list[RosterCsvRow]) -> list[RosterCsvRow]:
    grouped: dict[tuple[str, str], list[RosterCsvRow]] = defaultdict(list)
    for row in rows:
        grouped[(row.team_slug, row.decade)].append(row)

    extras: list[RosterCsvRow] = []
    for (team_slug, decade), group in grouped.items():
        sponsors = [r for r in group if r.entity_type == "sponsor"]
        has_secondary = any(r.sponsor_tier == "secondary" for r in sponsors)
        if not has_secondary:
            title = next((r for r in sponsors if r.sponsor_tier == "title"), None)
            if title:
                extras.append(
                    RosterCsvRow(
                        team_slug=team_slug,
                        decade=decade,
                        entity_type="sponsor",
                        slug=f"{title.slug}-pool-secondary",
                        display_name=title.display_name,
                        nationality=title.nationality,
                        career_start_year=title.career_start_year,
                        career_end_year=title.career_end_year,
                        peak_year=title.peak_year,
                        personnel_role=None,
                        sponsor_tier="secondary",
                        accent_color=title.accent_color,
                        motto_text=None,
                        teams_history=title.teams_history,
                        source_url=title.source_url,
                        data_quality="synthetic",
                        stats_json=dict(title.stats_json),
                    )
                )

        has_motto = any(r.entity_type == "motto" for r in group)
        if not has_motto:
            name = team_display_name(team_slug)
            extras.append(
                RosterCsvRow(
                    team_slug=team_slug,
                    decade=decade,
                    entity_type="motto",
                    slug=f"{team_slug}-{decade}-default-motto",
                    display_name=f"Forza {name}",
                    nationality=None,
                    career_start_year=None,
                    career_end_year=None,
                    peak_year=None,
                    personnel_role=None,
                    sponsor_tier=None,
                    accent_color=None,
                    motto_text=f"Forza {name}",
                    teams_history=[team_slug],
                    source_url=None,
                    data_quality="synthetic",
                    stats_json={},
                )
            )

    return rows + extras


def import_roster_master(db: Session, csv_path: Path | None = None, *, replace: bool = True) -> int:
    rows = _backfill_gaps(load_roster_csv(csv_path))
    pool_max = driver_pool_maxima(rows)

    if replace:
        db.query(RosterEntry).delete()
        db.commit()

    for row in rows:
        db.add(_entry_from_row(row, pool_max))

    db.commit()
    return len(rows)


def ensure_roster_imported(db: Session) -> bool:
    """Import CSV when roster_entries is empty. Returns True when import ran."""
    if db.query(RosterEntry).count() > 0:
        return False
    if not CSV_PATH.exists():
        return False
    import_roster_master(db)
    return True
