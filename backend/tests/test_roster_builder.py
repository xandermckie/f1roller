from collections import defaultdict

import pytest

from app.services.roster_builder import (
    LEAD_ENGINEER_FALLBACK_WARNING,
    build_roster,
    roll_decade,
    roll_team,
)
from app.services.roster_import import import_roster_master


@pytest.fixture
def csv_roster(db_session):
    import_roster_master(db_session)
    return db_session


def test_ferrari_1990s_includes_schumacher_era_staff(csv_roster):
    roster = build_roster(csv_roster, "ferrari", "1990s")
    driver_slugs = {e.slug for e in roster.entities if e.entity_type == "driver"}
    personnel_slugs = {e.slug for e in roster.entities if e.entity_type == "personnel"}
    assert "michael-schumacher-90s" in driver_slugs
    assert "jean-todt-tp" in personnel_slugs
    assert "ross-brawn-td" in personnel_slugs
    assert roster.team_display_name == "Ferrari"


def test_td_assignable_to_lead_engineer_when_no_le(csv_roster):
    roster = build_roster(csv_roster, "ferrari", "1950s")
    assert LEAD_ENGINEER_FALLBACK_WARNING in roster.pool_warnings

    td_entities = [
        e
        for e in roster.entities
        if e.entity_type == "personnel" and e.role_label == "Technical Director"
    ]
    assert td_entities
    assert "lead_engineer" in td_entities[0].assignable_slots


def test_ferrari_1990s_has_dedicated_lead_engineer(csv_roster):
    roster = build_roster(csv_roster, "ferrari", "1990s")
    le_entities = [
        e
        for e in roster.entities
        if e.entity_type == "personnel" and "lead_engineer" in e.assignable_slots
    ]
    assert any(e.slug == "rory-byrne-le" for e in le_entities)
    assert LEAD_ENGINEER_FALLBACK_WARNING not in roster.pool_warnings


def test_personnel_assignable_slots_match_role(csv_roster):
    roster = build_roster(csv_roster, "ferrari", "2000s")
    for entity in roster.entities:
        if entity.entity_type == "personnel":
            if entity.role_label == "Team Principal":
                assert entity.assignable_slots == ["team_principal"]
            elif entity.role_label == "Technical Director":
                assert "technical_director" in entity.assignable_slots
            elif entity.role_label == "Lead Engineer":
                assert entity.assignable_slots == ["lead_engineer"]


def test_thin_combo_still_returns_roster(csv_roster):
    roster = build_roster(csv_roster, "cadillac", "2020s")
    assert roster.team_slug == "cadillac"
    assert len(roster.entities) > 0


def test_roll_team_and_decade_are_deterministic(csv_roster):
    team_a, _ = roll_team(csv_roster, "seed-1")
    team_b, _ = roll_team(csv_roster, "seed-1")
    assert team_a == team_b

    decade_a = roll_decade(csv_roster, "seed-1", team_a)
    decade_b = roll_decade(csv_roster, "seed-1", team_a)
    assert decade_a == decade_b

    team_reroll, _ = roll_team(csv_roster, "seed-1", reroll_salt="reroll-1")
    decade_reroll = roll_decade(csv_roster, "seed-1", team_reroll, reroll_salt="reroll-1")
    assert team_reroll != team_a or decade_reroll != decade_a


def test_every_combo_can_fill_twelve_slots(csv_roster):
    from app.models.roster_entry import RosterEntry

    combos = (
        csv_roster.query(RosterEntry.team_slug, RosterEntry.decade).distinct().all()
    )
    for team_slug, decade in combos:
        roster = build_roster(csv_roster, team_slug, decade)
        slot_counts: dict[str, int] = defaultdict(int)
        for entity in roster.entities:
            for slot in entity.assignable_slots:
                slot_counts[slot] += 1
        required = [
            "driver_1",
            "driver_2",
            "reserve_driver",
            "constructor",
            "engine",
            "team_principal",
            "technical_director",
            "lead_engineer",
            "title_sponsor",
            "secondary_sponsor",
            "livery_style",
            "team_motto",
        ]
        for slot in required:
            assert slot_counts[slot] >= 1, f"{team_slug}/{decade} missing {slot}"


def test_roster_api(client, csv_roster):
    roll_resp = client.post(
        "/api/roster/roll-team",
        json={"session_seed": "api-test"},
    )
    assert roll_resp.status_code == 200
    team = roll_resp.json()

    decade_resp = client.post(
        "/api/roster/roll-decade",
        json={"session_seed": "api-test", "team_slug": team["slug"]},
    )
    assert decade_resp.status_code == 200
    decade = decade_resp.json()["decade"]

    roster_resp = client.get(
        f"/api/roster?team_slug={team['slug']}&decade={decade}",
    )
    assert roster_resp.status_code == 200
    body = roster_resp.json()
    assert body["team_slug"] == team["slug"]
    assert body["decade"] == decade
    assert len(body["entities"]) > 0
