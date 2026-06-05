"""StatsF1 HTML scraper with caching."""

from __future__ import annotations

import hashlib
import re
import time
from datetime import datetime, timedelta, timezone

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.config import settings
from app.models.scrape_cache import ScrapeCache


def _html_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def _parse_int(text: str) -> int:
    cleaned = re.sub(r"[^\d]", "", text or "0")
    return int(cleaned) if cleaned else 0


def _parse_float(text: str) -> float:
    cleaned = re.sub(r"[^\d.]", "", text.replace(",", ".") or "0")
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0


def parse_driver_page(html: str, slug: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    name_el = soup.select_one("h1, .pilote-nom, .driver-name")
    display_name = name_el.get_text(strip=True) if name_el else slug.replace("-", " ").title()

    stats = {
        "gp_starts": 0,
        "wins": 0,
        "poles": 0,
        "podiums": 0,
        "avg_finish": 10.0,
        "championships": 0,
    }

    for row in soup.select("table tr"):
        cells = row.select("td, th")
        if len(cells) < 2:
            continue
        label = cells[0].get_text(strip=True).lower()
        value = cells[1].get_text(strip=True)
        if "grand prix" in label or "gp" in label or "starts" in label or "races" in label:
            stats["gp_starts"] = _parse_int(value)
        elif "victori" in label or "win" in label:
            stats["wins"] = _parse_int(value)
        elif "pole" in label:
            stats["poles"] = _parse_int(value)
        elif "podium" in label:
            stats["podiums"] = _parse_int(value)
        elif "average" in label and "finish" in label:
            stats["avg_finish"] = _parse_float(value) or 10.0
        elif "champion" in label:
            stats["championships"] = _parse_int(value)

    return {"slug": slug, "display_name": display_name, "stats": stats, "source": "statsf1"}


def get_cached(db: Session, url: str) -> ScrapeCache | None:
    row = db.query(ScrapeCache).filter(ScrapeCache.source_url == url).first()
    if not row or not row.ttl_expires_at:
        return None
    if row.ttl_expires_at < datetime.now(timezone.utc):
        return None
    return row


def fetch_and_cache(db: Session, url: str, slug: str) -> dict | None:
    cached = get_cached(db, url)
    if cached and cached.parsed_json:
        return cached.parsed_json

    time.sleep(settings.scrape_delay_ms / 1000.0)

    try:
        with httpx.Client(timeout=30.0, headers={"User-Agent": settings.user_agent}) as client:
            response = client.get(url)
            response.raise_for_status()
            html = response.text
    except httpx.HTTPError:
        return None

    parsed = parse_driver_page(html, slug)
    now = datetime.now(timezone.utc)
    ttl = now + timedelta(days=settings.cache_ttl_days)
    html_hash = _html_hash(html)

    existing = db.query(ScrapeCache).filter(ScrapeCache.source_url == url).first()
    if existing:
        if existing.raw_html_hash == html_hash and existing.parsed_json:
            existing.ttl_expires_at = ttl
            db.commit()
            return existing.parsed_json
        existing.raw_html_hash = html_hash
        existing.parsed_json = parsed
        existing.fetched_at = now
        existing.ttl_expires_at = ttl
    else:
        db.add(
            ScrapeCache(
                source_url=url,
                entity_type="driver",
                entity_id=slug,
                raw_html_hash=html_hash,
                parsed_json=parsed,
                fetched_at=now,
                ttl_expires_at=ttl,
            )
        )
    db.commit()
    return parsed
