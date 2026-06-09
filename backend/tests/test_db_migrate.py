from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app.db_migrate import _sqlite_column_names, upgrade_schema


def test_upgrade_adds_personnel_peak_year_and_teams_history():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE personnel (
                    id TEXT PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    stats_json TEXT,
                    computed_rating REAL,
                    era_factor REAL,
                    data_quality TEXT,
                    sources TEXT,
                    collaborators TEXT
                )
                """
            )
        )

    upgrade_schema(engine)
    columns = _sqlite_column_names(engine, "personnel")
    assert "peak_year" in columns
    assert "teams_history" in columns


def test_upgrade_schema_is_idempotent():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE personnel (
                    id TEXT PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    peak_year INTEGER,
                    teams_history TEXT,
                    stats_json TEXT,
                    computed_rating REAL,
                    era_factor REAL,
                    data_quality TEXT,
                    sources TEXT,
                    collaborators TEXT
                )
                """
            )
        )

    upgrade_schema(engine)
    upgrade_schema(engine)
    columns = _sqlite_column_names(engine, "personnel")
    assert "peak_year" in columns
    assert "teams_history" in columns
