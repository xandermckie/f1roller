import uuid

from sqlalchemy import Float, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SynergyPair(Base):
    __tablename__ = "synergy_pairs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entity_a_slug: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_b_slug: Mapped[str] = mapped_column(String(128), nullable=False)
    pair_type: Mapped[str] = mapped_column(String(64), nullable=False)
    bonus: Mapped[float] = mapped_column(Float, nullable=False)
