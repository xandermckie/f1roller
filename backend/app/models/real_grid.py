import uuid

from sqlalchemy import Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class RealGridEntry(Base):
    __tablename__ = "real_grid_2026"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_name: Mapped[str] = mapped_column(String(128), nullable=False)
    driver_number: Mapped[int | None] = mapped_column(Integer)
    driver_name: Mapped[str] = mapped_column(String(128), nullable=False)
    driver_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    constructor_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    constructor_name: Mapped[str] = mapped_column(String(128), nullable=False)
