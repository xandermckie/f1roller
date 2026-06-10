import uuid

from sqlalchemy import Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db import Base


class RosterEntry(Base):
    __tablename__ = "roster_entries"
    __table_args__ = (
        UniqueConstraint("team_slug", "decade", "slug", name="uq_roster_team_decade_slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    decade: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)
    nationality: Mapped[str | None] = mapped_column(String(64))
    career_start_year: Mapped[int | None] = mapped_column(Integer)
    career_end_year: Mapped[int | None] = mapped_column(Integer)
    peak_year: Mapped[int | None] = mapped_column(Integer)
    personnel_role: Mapped[str | None] = mapped_column(String(32))
    sponsor_tier: Mapped[str | None] = mapped_column(String(16))
    accent_color: Mapped[str | None] = mapped_column(String(16))
    motto_text: Mapped[str | None] = mapped_column(String(512))
    teams_history: Mapped[list] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list
    )
    stats_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict)
    computed_rating: Mapped[float] = mapped_column(Float, default=0.5)
    era_factor: Mapped[float] = mapped_column(Float, default=1.0)
    source_url: Mapped[str | None] = mapped_column(Text)
    data_quality: Mapped[str | None] = mapped_column(String(32))
