import uuid

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db import Base


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)
    nationality: Mapped[str | None] = mapped_column(String(64))
    career_start_year: Mapped[int | None] = mapped_column(Integer)
    career_end_year: Mapped[int | None] = mapped_column(Integer)
    peak_year: Mapped[int | None] = mapped_column(Integer)
    stats_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict)
    computed_rating: Mapped[float] = mapped_column(Float, default=0.5)
    era_factor: Mapped[float] = mapped_column(Float, default=1.0)
    portrait_path: Mapped[str | None] = mapped_column(String(512))
    data_quality: Mapped[str] = mapped_column(String(32), default="seed")
    sources: Mapped[list] = mapped_column(
        JSON().with_variant(ARRAY(Text), "postgresql"), default=list
    )
    teams_history: Mapped[list] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list
    )
