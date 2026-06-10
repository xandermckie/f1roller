from app.services.roster_csv import (
    CSV_PATH,
    infer_personnel_role,
    load_roster_csv,
    parse_csv_row,
)


def test_csv_loads_all_rows():
    rows = load_roster_csv(CSV_PATH)
    assert len(rows) >= 600


def test_infer_personnel_role_from_slug_suffix():
    row = {
        "personnel_role": "",
        "slug": "frank-williams-tp",
        "notes": "",
    }
    assert infer_personnel_role(row) == "team_principal"

    row["slug"] = "patrick-head-td-80s"
    assert infer_personnel_role(row) == "technical_director"

    row["slug"] = "rory-byrne-le"
    assert infer_personnel_role(row) == "lead_engineer"


def test_infer_personnel_role_from_explicit_column():
    row = {
        "personnel_role": "technical_director",
        "slug": "ross-brawn-td",
        "notes": "",
    }
    assert infer_personnel_role(row) == "technical_director"


def test_parse_driver_stats():
    row = parse_csv_row(
        {
            "team_slug": "ferrari",
            "decade": "1990s",
            "entity_type": "driver",
            "slug": "michael-schumacher",
            "display_name": "Michael Schumacher",
            "nationality": "German",
            "career_start_year": "1991",
            "career_end_year": "2012",
            "peak_year": "2004",
            "personnel_role": "",
            "sponsor_tier": "",
            "accent_color": "",
            "gp_starts": "308",
            "wins": "91",
            "poles": "68",
            "podiums": "155",
            "avg_finish": "3.2",
            "championships": "7",
            "starts": "",
            "team_success": "",
            "livery_slug": "",
            "motto_text": "",
            "teams_history": "ferrari",
            "source_url": "",
            "data_quality": "verified",
            "notes": "",
        }
    )
    assert row.stats_json["wins"] == 91
    assert row.stats_json["poles"] == 68
    assert row.peak_year == 2004
