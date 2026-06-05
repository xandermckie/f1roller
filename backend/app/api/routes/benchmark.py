from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.benchmark_team import BenchmarkTeam
from app.schemas.common import BenchmarkResponse, TeamPayload
from app.services.benchmark import compute_benchmark, save_benchmark

router = APIRouter()


@router.get("/benchmark", response_model=BenchmarkResponse)
def benchmark(db: Session = Depends(get_db)) -> BenchmarkResponse:
    row = db.query(BenchmarkTeam).filter(BenchmarkTeam.id == 1).first()
    if row and row.slots_json:
        return BenchmarkResponse(
            team=TeamPayload.model_validate(row.slots_json),
            projected_wdc_points=row.projected_wdc_points,
            projected_wcc_points=row.projected_wcc_points,
            team_pace=row.team_pace,
            computed_at=row.computed_at,
        )

    payload, pace, _ = compute_benchmark(db)
    row = save_benchmark(db, payload, pace)
    return BenchmarkResponse(
        team=payload,
        projected_wdc_points=row.projected_wdc_points,
        projected_wcc_points=row.projected_wcc_points,
        team_pace=row.team_pace,
        computed_at=row.computed_at,
    )
