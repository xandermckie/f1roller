from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    meeting_key: Mapped[int] = mapped_column(Integer, primary_key=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    meeting_name: Mapped[str] = mapped_column(String(256), nullable=False)
    circuit_key: Mapped[int | None] = mapped_column(Integer)
    circuit_short_name: Mapped[str | None] = mapped_column(String(128))
    country_name: Mapped[str | None] = mapped_column(String(128))
    date_start: Mapped[datetime | None] = mapped_column(DateTime)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    circuit_map_path: Mapped[str | None] = mapped_column(String(512))
    openf1_circuit_image_url: Mapped[str | None] = mapped_column(String(1024))
