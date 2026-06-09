from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.benchmark_team import BenchmarkTeam
from app.models.constructor import Constructor
from app.models.driver import Driver
from app.models.engine_entity import EngineEntity
from app.models.personnel import Personnel
from app.models.real_grid import RealGridEntry
from app.models.sponsor import Sponsor
from app.schemas.common import CompareRequest, CompareResponse, SimulateRequest, SimResult, TeamPayload
from app.services.openf1 import fallback_calendar_2026, get_calendar
from app.services.rival_generator import generate_rivals
from app.services.simulator import CalendarRace, simulate_season
from app.services.synergy import EntityRef
from app.services.team_builder import build_user_team
from app.services.team_pace import TeamEntities

router = APIRouter()


def _get_calendar_races(db: Session) -> list[CalendarRace]:
    events = get_calendar(db, settings.sim_season_year)
    if not events:
        events = fallback_calendar_2026(db)
    return [
        CalendarRace(
            round_number=e.round_number,
            meeting_key=e.meeting_key,
            meeting_name=e.meeting_name,
            circuit_short_name=e.circuit_short_name,
            circuit_key=e.circuit_key,
        )
        for e in events
    ]


def _apply_efficiency(db: Session, result: SimResult) -> SimResult:
    benchmark = db.query(BenchmarkTeam).filter(BenchmarkTeam.id == 1).first()
    if benchmark and benchmark.projected_wdc_points > 0:
        user_pts = max((e.points for e in result.final_wdc if e.is_user), default=0)
        result.user_summary.team_efficiency_pct = round(
            (user_pts / benchmark.projected_wdc_points) * 100, 1
        )
    return result


def _run_simulation(db: Session, team_payload: TeamPayload, session_seed: str) -> SimResult:
    try:
        user_team = build_user_team(db, team_payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid team payload") from exc

    try:
        rivals = generate_rivals(
            db,
            [
                UUID(team_payload.driver_1_id),
                UUID(team_payload.driver_2_id),
                UUID(team_payload.reserve_driver_id),
            ],
        )
        calendar = _get_calendar_races(db)
        result = simulate_season(user_team, rivals, calendar, session_seed)
        return _apply_efficiency(db, result)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Simulation failed") from exc


@router.post("/simulate", response_model=SimResult)
def simulate(request: SimulateRequest, db: Session = Depends(get_db)) -> SimResult:
    return _run_simulation(db, request.team, request.session_seed)


@router.post("/simulate/compare", response_model=CompareResponse)
def simulate_compare(request: CompareRequest, db: Session = Depends(get_db)) -> CompareResponse:
    user_result = _run_simulation(db, request.user_team, request.session_seed)
    real_result = _simulate_real_grid(db, request.session_seed) if request.include_real_grid else None
    return CompareResponse(user=user_result, real_grid=real_result)


def _build_real_grid_teams(db: Session) -> list[TeamEntities]:
    entries = db.query(RealGridEntry).all()
    teams_by_name: dict[str, list[RealGridEntry]] = {}
    for entry in entries:
        teams_by_name.setdefault(entry.team_name, []).append(entry)

    engine = db.query(EngineEntity).order_by(EngineEntity.computed_rating.desc()).first()
    tp = db.query(Personnel).filter(Personnel.role == "team_principal").first()
    td = db.query(Personnel).filter(Personnel.role == "technical_director").first()
    eng = db.query(Personnel).filter(Personnel.role == "lead_engineer").first()

    if not all([engine, tp, td, eng]):
        return []

    real_teams: list[TeamEntities] = []
    for team_name, drivers in teams_by_name.items():
        d1_entry = drivers[0]
        d2_entry = drivers[1] if len(drivers) > 1 else drivers[0]

        d1 = (
            db.query(Driver).filter(Driver.id == d1_entry.driver_entity_id).first()
            if d1_entry.driver_entity_id
            else None
        )
        d2 = (
            db.query(Driver).filter(Driver.id == d2_entry.driver_entity_id).first()
            if d2_entry.driver_entity_id
            else None
        )
        constructor = (
            db.query(Constructor).filter(Constructor.id == d1_entry.constructor_entity_id).first()
            if d1_entry.constructor_entity_id
            else None
        )

        if not d1 or not constructor:
            continue

        d2 = d2 or d1
        real_teams.append(
            TeamEntities(
                driver_1_rating=d1.computed_rating,
                driver_2_rating=d2.computed_rating,
                reserve_rating=d2.computed_rating * 0.5,
                constructor_rating=constructor.computed_rating,
                engine_rating=engine.computed_rating,
                tp_rating=tp.computed_rating,
                td_rating=td.computed_rating,
                engineer_rating=eng.computed_rating,
                driver_1=EntityRef(d1.slug, d1.display_name, d1.peak_year, d1.teams_history or []),
                driver_2=EntityRef(d2.slug, d2.display_name, d2.peak_year, d2.teams_history or []),
                reserve=EntityRef(d2.slug, d2.display_name, d2.peak_year, d2.teams_history or []),
                constructor_slug=constructor.slug,
                engine_slug=engine.slug,
                tp_slug=tp.slug,
                engineer_slug=eng.slug,
                team_name=team_name,
            )
        )

    return real_teams


def _simulate_real_grid(db: Session, session_seed: str) -> SimResult:
    real_teams = _build_real_grid_teams(db)
    calendar = _get_calendar_races(db)

    if not real_teams:
        return simulate_season(
            _placeholder_team(db),
            generate_rivals(db, [], count=19),
            calendar,
            f"{session_seed}-real",
        )

    proxy = real_teams[0]
    others = real_teams[1:]
    while len(others) < 19:
        rivals = generate_rivals(db, [], count=1)
        if rivals:
            others.append(rivals[0])
        else:
            break

    result = simulate_season(proxy, others[:19], calendar, f"{session_seed}-real")
    return _apply_efficiency(db, result)


def _placeholder_team(db: Session) -> TeamEntities:
    return build_user_team(db, _default_team_payload(db))


def _default_team_payload(db: Session) -> TeamPayload:
    d1 = db.query(Driver).first()
    d2 = db.query(Driver).offset(1).first()
    d3 = db.query(Driver).offset(2).first()
    constructor = db.query(Constructor).first()
    engine = db.query(EngineEntity).first()
    tp = db.query(Personnel).filter(Personnel.role == "team_principal").first()
    td = db.query(Personnel).filter(Personnel.role == "technical_director").first()
    eng = db.query(Personnel).filter(Personnel.role == "lead_engineer").first()
    title = db.query(Sponsor).filter(Sponsor.tier == "title").first()
    secondary = db.query(Sponsor).filter(Sponsor.tier == "secondary").first()

    return TeamPayload(
        driver_1_id=str(d1.id),
        driver_2_id=str(d2.id),
        reserve_driver_id=str(d3.id),
        constructor_id=str(constructor.id),
        engine_id=str(engine.id),
        team_principal_id=str(tp.id),
        technical_director_id=str(td.id),
        lead_engineer_id=str(eng.id),
        title_sponsor_id=str(title.id),
        secondary_sponsor_id=str(secondary.id),
    )
