from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db import Base


class ScrapeCache(Base):
    __tablename__ = "scrape_cache"

    source_url: Mapped[str] = mapped_column(String(1024), primary_key=True)
    entity_type: Mapped[str | None] = mapped_column(String(64))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    raw_html_hash: Mapped[str | None] = mapped_column(String(64))
    parsed_json: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), default=dict
    )
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime)
    ttl_expires_at: Mapped[datetime | None] = mapped_column(DateTime)
