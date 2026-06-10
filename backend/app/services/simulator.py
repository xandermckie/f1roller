"""Season simulation engine."""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass

from app.schemas.common import (
    ChampionshipEntry,
    RacePosition,
    RaceResult,
    SimResult,
    UserSummary,
)
from app.services.team_pace import TeamEntities, compute_team_pace

POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
MAX_SEASON_ROUNDS = 16


@dataclass
class SimTeam:
    team_name: str
    driver_1_name: str
    driver_2_name: str
    pace: float
    driver_1_rating: float
    is_user: bool = False


@dataclass
class CalendarRace:
    round_number: int
    meeting_key: int
    meeting_name: str
    circuit_short_name: str | None
    circuit_key: int | None


def seeded_rng(session_seed: str, salt: str) -> random.Random:
    digest = hashlib.sha256(f"{session_seed}:{salt}".encode()).hexdigest()
    return random.Random(int(digest[:16], 16))


def sort_teams_with_tiebreak(teams: list[SimTeam], scores: list[float]) -> list[tuple[SimTeam, float]]:
    indexed = list(zip(teams, scores, strict=True))
    indexed.sort(
        key=lambda x: (x[1], x[0].pace, x[0].driver_1_rating),
        reverse=True,
    )
    return indexed


def build_sim_teams(user_team: TeamEntities, rival_teams: list[TeamEntities]) -> list[SimTeam]:
    user_pace, _, _ = compute_team_pace(user_team)
    all_teams: list[SimTeam] = [
        SimTeam(
            team_name=user_team.team_name,
            driver_1_name=user_team.driver_1.display_name,
            driver_2_name=user_team.driver_2.display_name,
            pace=user_pace,
            driver_1_rating=user_team.driver_1_rating,
            is_user=True,
        )
    ]
    for rival in rival_teams:
        pace, _, _ = compute_team_pace(rival)
        all_teams.append(
            SimTeam(
                team_name=rival.team_name,
                driver_1_name=rival.driver_1.display_name,
                driver_2_name=rival.driver_2.display_name,
                pace=pace,
                driver_1_rating=rival.driver_1_rating,
                is_user=False,
            )
        )
    return all_teams


def simulate_race(
    all_teams: list[SimTeam],
    race: CalendarRace,
    session_seed: str,
    driver_points: dict[str, int],
    constructor_points: dict[str, int],
    user_team_name: str,
    user_driver_names: set[str],
) -> tuple[RaceResult, int]:
    rng = seeded_rng(session_seed, f"race-{race.round_number}")
    scores = [team.pace + rng.uniform(-0.8, 0.8) for team in all_teams]
    ranked = sort_teams_with_tiebreak(all_teams, scores)

    positions: list[RacePosition] = []
    user_race_pts = 0
    user_wins_delta = 0

    for pos, (team, _score) in enumerate(ranked, start=1):
        pts = POINTS_TABLE[pos - 1] if pos <= 10 else 0
        d1_pts = pts // 2 + (pts % 2)
        d2_pts = pts // 2

        driver_points[team.driver_1_name] = driver_points.get(team.driver_1_name, 0) + d1_pts
        driver_points[team.driver_2_name] = driver_points.get(team.driver_2_name, 0) + d2_pts
        constructor_points[team.team_name] = constructor_points.get(team.team_name, 0) + pts

        if team.is_user:
            user_race_pts = pts
            if pos == 1:
                user_wins_delta = 1

        positions.append(
            RacePosition(
                position=pos,
                driver_name=f"{team.driver_1_name} / {team.driver_2_name}",
                team_name=team.team_name,
                points=pts,
                is_user_team=team.is_user,
                is_user_driver=team.is_user,
            )
        )

    race_result = RaceResult(
        round=race.round_number,
        meeting_key=race.meeting_key,
        meeting_name=race.meeting_name,
        circuit_short_name=race.circuit_short_name,
        circuit_key=race.circuit_key,
        positions=positions[:20],
        user_race_points=user_race_pts,
        user_wdc_points_after=max(
            driver_points.get(name, 0) for name in user_driver_names
        ),
        user_wcc_points_after=constructor_points.get(user_team_name, 0),
    )
    return race_result, user_wins_delta


def _build_final_standings(
    user_team: TeamEntities,
    driver_points: dict[str, int],
    constructor_points: dict[str, int],
    user_wins: int,
) -> SimResult:
    wdc_sorted = sorted(driver_points.items(), key=lambda x: x[1], reverse=True)
    wcc_sorted = sorted(constructor_points.items(), key=lambda x: x[1], reverse=True)

    user_drivers = {user_team.driver_1.display_name, user_team.driver_2.display_name}
    wdc_position = next(
        (i + 1 for i, (name, _) in enumerate(wdc_sorted) if name in user_drivers),
        len(wdc_sorted),
    )
    wcc_position = next(
        (i + 1 for i, (name, _) in enumerate(wcc_sorted) if name == user_team.team_name),
        len(wcc_sorted),
    )

    final_wdc = [
        ChampionshipEntry(name=name, points=pts, is_user=name in user_drivers)
        for name, pts in wdc_sorted[:15]
    ]
    final_wcc = [
        ChampionshipEntry(
            name=name,
            points=pts,
            is_user=name == user_team.team_name,
        )
        for name, pts in wcc_sorted[:12]
    ]

    return SimResult(
        races=[],
        final_wdc=final_wdc,
        final_wcc=final_wcc,
        user_summary=UserSummary(
            wdc_position=wdc_position,
            wcc_position=wcc_position,
            wins=user_wins,
            poles=0,
        ),
        session_seed="",
    )


def simulate_season(
    user_team: TeamEntities,
    rival_teams: list[TeamEntities],
    calendar: list[CalendarRace],
    session_seed: str,
) -> SimResult:
    calendar = calendar[:MAX_SEASON_ROUNDS]
    all_teams = build_sim_teams(user_team, rival_teams)
    driver_points: dict[str, int] = {}
    constructor_points: dict[str, int] = {}
    user_wins = 0
    races: list[RaceResult] = []
    user_driver_names = {user_team.driver_1.display_name, user_team.driver_2.display_name}

    for race in calendar:
        race_result, wins_delta = simulate_race(
            all_teams,
            race,
            session_seed,
            driver_points,
            constructor_points,
            user_team.team_name,
            user_driver_names,
        )
        user_wins += wins_delta
        races.append(race_result)

    result = _build_final_standings(user_team, driver_points, constructor_points, user_wins)
    result.races = races
    result.session_seed = session_seed
    return result


def simulate_through_round(
    user_team: TeamEntities,
    rival_teams: list[TeamEntities],
    calendar: list[CalendarRace],
    session_seed: str,
    through_round: int,
) -> tuple[RaceResult, int, SimResult | None]:
    calendar = calendar[:MAX_SEASON_ROUNDS]
    if through_round < 1 or through_round > len(calendar):
        raise ValueError(f"Round {through_round} is out of range")

    partial = simulate_season(
        user_team,
        rival_teams,
        calendar[:through_round],
        session_seed,
    )
    race = partial.races[-1]
    wins = partial.user_summary.wins
    season_result = partial if through_round >= min(len(calendar), MAX_SEASON_ROUNDS) else None
    return race, wins, season_result
