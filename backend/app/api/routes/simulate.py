from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.benchmark_team import BenchmarkTeam
from app.schemas.common import (
    CompareRequest,
    CompareResponse,
    RoundSimResult,
    SimInitializeRequest,
    SimInitializeResponse,
    SimulateRequest,
    SimulateRoundRequest,
    SimResult,
    TeamPayload,
)
from app.services.openf1 import fallback_calendar_2026, get_calendar
from app.services.real_grid_builder import build_real_grid_teams
from app.services.rival_generator import generate_rivals
from app.services.simulator import MAX_SEASON_ROUNDS, CalendarRace, simulate_season, simulate_through_round
from app.services.team_builder import build_user_team
from app.services.team_pace import TeamEntities

router = APIRouter()


def _get_calendar_races(db: Session, max_rounds: int | None = None) -> list[CalendarRace]:
    events = get_calendar(db, settings.sim_season_year)
    if not events:
        events = fallback_calendar_2026(db)
    races = [
        CalendarRace(
            round_number=e.round_number,
            meeting_key=e.meeting_key,
            meeting_name=e.meeting_name,
            circuit_short_name=e.circuit_short_name,
            circuit_key=e.circuit_key,
        )
        for e in events
    ]
    limit = max_rounds if max_rounds is not None else MAX_SEASON_ROUNDS
    return races[:limit]


def _apply_efficiency(db: Session, result: SimResult) -> SimResult:
    benchmark = db.query(BenchmarkTeam).filter(BenchmarkTeam.id == 1).first()
    if benchmark and benchmark.projected_wdc_points > 0:
        user_pts = max((e.points for e in result.final_wdc if e.is_user), default=0)
        result.user_summary.team_efficiency_pct = round(
            (user_pts / benchmark.projected_wdc_points) * 100, 1
        )
    return result


def _build_user_team(db: Session, team_payload: TeamPayload) -> TeamEntities:
    try:
        return build_user_team(db, team_payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid team payload") from exc


def _get_rival_teams(
    db: Session,
    team_payload: TeamPayload,
    game_mode: str,
) -> list[TeamEntities]:
    if game_mode == "2026":
        real_teams = build_real_grid_teams(db)
        if real_teams:
            return real_teams
    return generate_rivals(
        db,
        [
            UUID(team_payload.driver_1_id),
            UUID(team_payload.driver_2_id),
            UUID(team_payload.reserve_driver_id),
        ],
    )


def _run_simulation(
    db: Session,
    team_payload: TeamPayload,
    session_seed: str,
    game_mode: str = "historical",
) -> SimResult:
    user_team = _build_user_team(db, team_payload)
    try:
        rivals = _get_rival_teams(db, team_payload, game_mode)
        calendar = _get_calendar_races(db)
        result = simulate_season(user_team, rivals, calendar, session_seed)
        return _apply_efficiency(db, result)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Simulation failed") from exc


@router.post("/simulate/initialize", response_model=SimInitializeResponse)
def simulate_initialize(
    request: SimInitializeRequest,
    db: Session = Depends(get_db),
) -> SimInitializeResponse:
    _build_user_team(db, request.team)
    events = get_calendar(db, settings.sim_season_year)
    if not events:
        events = fallback_calendar_2026(db)
    return SimInitializeResponse(
        max_rounds=MAX_SEASON_ROUNDS,
        calendar=events[:MAX_SEASON_ROUNDS],
    )


@router.post("/simulate/round", response_model=RoundSimResult)
def simulate_round(
    request: SimulateRoundRequest,
    db: Session = Depends(get_db),
) -> RoundSimResult:
    user_team = _build_user_team(db, request.team)
    calendar = _get_calendar_races(db)
    if request.round_number < 1 or request.round_number > len(calendar):
        raise HTTPException(status_code=400, detail="Round number out of range")

    try:
        rivals = _get_rival_teams(db, request.team, request.game_mode)
        race, wins_so_far, season_result = simulate_through_round(
            user_team,
            rivals,
            calendar,
            request.session_seed,
            request.round_number,
        )
        if season_result:
            season_result = _apply_efficiency(db, season_result)
        return RoundSimResult(
            race=race,
            wins_so_far=wins_so_far,
            max_wins=MAX_SEASON_ROUNDS,
            is_complete=request.round_number >= MAX_SEASON_ROUNDS,
            season_result=season_result,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Simulation failed") from exc


@router.post("/simulate", response_model=SimResult)
def simulate(request: SimulateRequest, db: Session = Depends(get_db)) -> SimResult:
    return _run_simulation(db, request.team, request.session_seed)


@router.post("/simulate/compare", response_model=CompareResponse)
def simulate_compare(request: CompareRequest, db: Session = Depends(get_db)) -> CompareResponse:
    user_result = _run_simulation(db, request.user_team, request.session_seed, "historical")
    real_result = (
        _run_simulation(db, request.user_team, request.session_seed, "2026")
        if request.include_real_grid
        else None
    )
    return CompareResponse(user=user_result, real_grid=real_result)
