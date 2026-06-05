import uuid

from sqlalchemy import Float, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db import Base


class Personnel(Base):
    __tablename__ = "personnel"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(String(64), nullable=False)
    stats_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict)
    computed_rating: Mapped[float] = mapped_column(Float, default=0.5)
    era_factor: Mapped[float] = mapped_column(Float, default=1.0)
    data_quality: Mapped[str] = mapped_column(String(32), default="seed")
    sources: Mapped[list] = mapped_column(
        JSON().with_variant(ARRAY(Text), "postgresql"), default=list
    )
    collaborators: Mapped[list] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=list
    )
