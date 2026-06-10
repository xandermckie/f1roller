import pytest

from app.services.draw_packet import CURRENT_GRID_SLUGS, build_draw_packet
from app.services.roster_import import import_roster_master


@pytest.fixture
def csv_roster(db_session):
    import_roster_master(db_session)
    return db_session


ALL_SLOTS = [
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


def test_draw_packet_returns_cards_for_empty_slots(csv_roster):
    draw = build_draw_packet(
        csv_roster,
        session_seed="seed-draw",
        game_mode="historical",
        empty_slots=ALL_SLOTS,
        round_index=0,
    )
    assert draw.team_slug
    assert draw.decade
    assert 1 <= len(draw.draw_packet) <= 8
    for entity in draw.draw_packet:
        assert entity.assignable_slots


def test_draw_packet_is_deterministic(csv_roster):
    kwargs = {
        "session_seed": "seed-deterministic",
        "game_mode": "historical",
        "empty_slots": ALL_SLOTS,
        "round_index": 2,
    }
    first = build_draw_packet(csv_roster, **kwargs)
    second = build_draw_packet(csv_roster, **kwargs)
    assert first.team_slug == second.team_slug
    assert first.decade == second.decade
    assert [entity.id for entity in first.draw_packet] == [
        entity.id for entity in second.draw_packet
    ]


def test_2026_mode_limits_to_current_grid(csv_roster):
    draw = build_draw_packet(
        csv_roster,
        session_seed="seed-2026",
        game_mode="2026",
        empty_slots=ALL_SLOTS,
        round_index=0,
    )
    assert draw.team_slug in CURRENT_GRID_SLUGS
    assert draw.decade == "2020s"


def test_draw_packet_respects_filled_slots(csv_roster):
    draw = build_draw_packet(
        csv_roster,
        session_seed="seed-partial",
        game_mode="historical",
        empty_slots=["team_principal", "technical_director", "lead_engineer"],
        round_index=9,
    )
    for entity in draw.draw_packet:
        assert any(
            slot in entity.assignable_slots
            for slot in ("team_principal", "technical_director", "lead_engineer")
        )
