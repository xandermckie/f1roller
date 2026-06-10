import pytest

from app.services.roster_builder import build_roster
from app.services.roster_import import import_roster_master


@pytest.fixture
def csv_roster(db_session):
    from app.models.calendar_event import CalendarEvent

    import_roster_master(db_session)
    db_session.add(
        CalendarEvent(
            meeting_key=9001,
            year=2026,
            round_number=1,
            meeting_name="Test Grand Prix",
            circuit_short_name="Test",
            is_cancelled=False,
        )
    )
    db_session.commit()
    return db_session


def _pick_entity(roster, entity_type: str, slot: str | None = None):
    for entity in roster.entities:
        if entity.entity_type != entity_type:
            continue
        if slot and slot not in entity.assignable_slots:
            continue
        return entity
    raise AssertionError(f"No {entity_type} for slot {slot}")


def _full_team_payload(db_session, team_slug: str = "ferrari", decade: str = "1990s") -> dict:
    roster = build_roster(db_session, team_slug, decade)
    drivers = [e for e in roster.entities if e.entity_type == "driver"]
    chassis = _pick_entity(roster, "constructor")
    engine = _pick_entity(roster, "engine")
    livery = _pick_entity(roster, "livery")
    motto = _pick_entity(roster, "motto")
    return {
        "driver_1_id": drivers[0].id,
        "driver_2_id": drivers[1].id,
        "reserve_driver_id": drivers[2].id,
        "constructor_id": chassis.id,
        "engine_id": engine.id,
        "team_principal_id": _pick_entity(roster, "personnel", "team_principal").id,
        "technical_director_id": _pick_entity(roster, "personnel", "technical_director").id,
        "lead_engineer_id": _pick_entity(roster, "personnel", "lead_engineer").id,
        "title_sponsor_id": _pick_entity(roster, "sponsor", "title_sponsor").id,
        "secondary_sponsor_id": _pick_entity(roster, "sponsor", "secondary_sponsor").id,
        "livery_style": livery.slug,
        "team_motto": motto.display_name,
    }


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_roster_roll_returns_entities(client, csv_roster):
    response = client.get("/api/roster?team_slug=ferrari&decade=1990s")
    assert response.status_code == 200
    data = response.json()
    assert data["team_slug"] == "ferrari"
    assert len(data["entities"]) > 0
    assert any(e["entity_type"] == "driver" for e in data["entities"])


def test_simulate_invalid_uuid_422(client, csv_roster):
    response = client.post(
        "/api/simulate",
        json={
            "team": {
                "driver_1_id": "not-a-uuid",
                "driver_2_id": "not-a-uuid",
                "reserve_driver_id": "not-a-uuid",
                "constructor_id": "not-a-uuid",
                "engine_id": "not-a-uuid",
                "team_principal_id": "not-a-uuid",
                "technical_director_id": "not-a-uuid",
                "lead_engineer_id": "not-a-uuid",
                "title_sponsor_id": "not-a-uuid",
                "secondary_sponsor_id": "not-a-uuid",
            },
            "session_seed": "test",
        },
    )
    assert response.status_code == 422


def test_simulate_with_roster_entries(client, csv_roster):
    team = _full_team_payload(csv_roster)
    response = client.post(
        "/api/simulate",
        json={"team": team, "session_seed": "roster-sim-test"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["races"]) > 0
    assert data["user_summary"]["wdc_position"] >= 1
