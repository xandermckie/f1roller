"""Lightweight schema upgrades for SQLite dev databases."""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

PERSONNEL_COLUMNS: dict[str, str] = {
    "peak_year": "INTEGER",
    "teams_history": "TEXT",
}


def _sqlite_column_names(engine: Engine, table: str) -> set[str]:
    with engine.connect() as conn:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def upgrade_schema(engine: Engine) -> None:
    """Add missing columns to existing tables. Idempotent."""
    inspector = inspect(engine)
    if not inspector.has_table("personnel"):
        return

    if engine.dialect.name == "sqlite":
        existing = _sqlite_column_names(engine, "personnel")
        with engine.begin() as conn:
            for column, col_type in PERSONNEL_COLUMNS.items():
                if column not in existing:
                    conn.execute(text(f"ALTER TABLE personnel ADD COLUMN {column} {col_type}"))
        return

    # PostgreSQL and others: use IF NOT EXISTS style via inspector
    existing = {col["name"] for col in inspector.get_columns("personnel")}
    with engine.begin() as conn:
        for column, col_type in PERSONNEL_COLUMNS.items():
            if column not in existing:
                if column == "teams_history":
                    conn.execute(text("ALTER TABLE personnel ADD COLUMN teams_history JSONB DEFAULT '[]'"))
                else:
                    conn.execute(text(f"ALTER TABLE personnel ADD COLUMN {column} {col_type}"))
