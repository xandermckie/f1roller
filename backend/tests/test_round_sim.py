import pytest

from app.schemas.common import TeamPayload
from app.services.roster_import import import_roster_master
from app.services.simulator import MAX_SEASON_ROUNDS, simulate_season, simulate_through_round
from app.services.team_builder import build_user_team
from app.services.rival_generator import generate_rivals
from app.api.routes.simulate import _get_calendar_races


@pytest.fixture
def csv_roster(db_session):
    import_roster_master(db_session)
    return db_session


def _sample_team_payload(db_session) -> TeamPayload:
    from app.models.roster_entry import RosterEntry

    def pick(entity_type: str, **filters) -> str:
        query = db_session.query(RosterEntry).filter(RosterEntry.entity_type == entity_type)
        for key, value in filters.items():
            query = query.filter(getattr(RosterEntry, key) == value)
        entry = query.order_by(RosterEntry.computed_rating.desc()).first()
        assert entry is not None
        return str(entry.id)

    drivers = (
        db_session.query(RosterEntry)
        .filter(RosterEntry.entity_type == "driver")
        .order_by(RosterEntry.computed_rating.desc())
        .limit(3)
        .all()
    )
    assert len(drivers) >= 3

    return TeamPayload(
        driver_1_id=str(drivers[0].id),
        driver_2_id=str(drivers[1].id),
        reserve_driver_id=str(drivers[2].id),
        constructor_id=pick("chassis"),
        engine_id=pick("engine"),
        team_principal_id=pick("personnel", personnel_role="team_principal"),
        technical_director_id=pick("personnel", personnel_role="technical_director"),
        lead_engineer_id=pick("personnel", personnel_role="lead_engineer"),
        title_sponsor_id=pick("sponsor", sponsor_tier="title"),
        secondary_sponsor_id=pick("sponsor", sponsor_tier="secondary"),
        livery_style="classic",
        team_motto="Speed is eternal",
    )


def test_round_sim_matches_full_season(csv_roster):
    payload = _sample_team_payload(csv_roster)
    user_team = build_user_team(csv_roster, payload)
    rivals = generate_rivals(
        csv_roster,
        [payload.driver_1_id, payload.driver_2_id, payload.reserve_driver_id],
        count=5,
    )
    calendar = _get_calendar_races(csv_roster)[:MAX_SEASON_ROUNDS]
    if len(calendar) < 2:
        pytest.skip("Calendar too short for round simulation test")

    full = simulate_season(user_team, rivals, calendar, "round-seed")
    race, wins, season_result = simulate_through_round(
        user_team,
        rivals,
        calendar,
        "round-seed",
        len(calendar),
    )

    assert race.round == len(calendar)
    assert wins == full.user_summary.wins
    assert season_result is not None
    assert season_result.user_summary.wins == full.user_summary.wins
    assert len(season_result.races) == len(full.races)


def test_round_sim_is_deterministic(csv_roster):
    payload = _sample_team_payload(csv_roster)
    user_team = build_user_team(csv_roster, payload)
    rivals = generate_rivals(
        csv_roster,
        [payload.driver_1_id, payload.driver_2_id, payload.reserve_driver_id],
        count=3,
    )
    calendar = _get_calendar_races(csv_roster)[:MAX_SEASON_ROUNDS]
    if not calendar:
        pytest.skip("No calendar available")

    first, wins_a, _ = simulate_through_round(user_team, rivals, calendar, "det-seed", 1)
    second, wins_b, _ = simulate_through_round(user_team, rivals, calendar, "det-seed", 1)
    assert first.meeting_key == second.meeting_key
    assert wins_a == wins_b
