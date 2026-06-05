from datetime import datetime

from sqlalchemy import DateTime, Float, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db import Base


class BenchmarkTeam(Base):
    __tablename__ = "benchmark_team"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    slots_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict)
    projected_wdc_points: Mapped[float] = mapped_column(Float, default=0.0)
    projected_wcc_points: Mapped[float] = mapped_column(Float, default=0.0)
    team_pace: Mapped[float] = mapped_column(Float, default=0.0)
    computed_at: Mapped[datetime | None] = mapped_column(DateTime)
