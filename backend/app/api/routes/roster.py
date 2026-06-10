from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.common import (
    RollDecadeRequest,
    RollTeamRequest,
    RolledDecadeResponse,
    RolledTeamResponse,
    RosterResponse,
)
from app.services.roster_builder import build_roster, roll_decade, roll_team

router = APIRouter()


@router.post("/roster/roll-team", response_model=RolledTeamResponse)
def api_roll_team(request: RollTeamRequest, db: Session = Depends(get_db)) -> RolledTeamResponse:
    slug, display_name = roll_team(
        db,
        request.session_seed,
        request.excluded_team_slugs,
        request.reroll_salt,
    )
    return RolledTeamResponse(slug=slug, display_name=display_name)


@router.post("/roster/roll-decade", response_model=RolledDecadeResponse)
def api_roll_decade(
    request: RollDecadeRequest,
    db: Session = Depends(get_db),
) -> RolledDecadeResponse:
    try:
        decade = roll_decade(db, request.session_seed, request.team_slug, request.reroll_salt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RolledDecadeResponse(decade=decade)


@router.get("/roster", response_model=RosterResponse)
def api_get_roster(
    team_slug: str = Query(...),
    decade: str = Query(...),
    db: Session = Depends(get_db),
) -> RosterResponse:
    try:
        return build_roster(db, team_slug, decade)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Database schema outdated. Restart the backend to run migrations, "
                "or delete backend/f1roller.db and re-seed."
            ),
        ) from exc
