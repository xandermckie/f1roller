"""OpenF1 API client for calendar and real grid."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.calendar_event import CalendarEvent
from app.models.real_grid import RealGridEntry


async def fetch_meetings(year: int) -> list[dict]:
    url = f"{settings.openf1_base_url}/meetings"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params={"year": year})
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, list) else []


def sync_calendar(db: Session, year: int, meetings: list[dict]) -> int:
    """Upsert calendar events, excluding pre-season testing."""
    count = 0
    round_num = 0
    for meeting in sorted(meetings, key=lambda m: m.get("date_start", "")):
        name = meeting.get("meeting_name", "")
        if "testing" in name.lower() or "test" in name.lower():
            continue
        if meeting.get("is_cancelled"):
            continue

        round_num += 1
        meeting_key = meeting["meeting_key"]
        date_start = None
        if meeting.get("date_start"):
            date_start = datetime.fromisoformat(
                meeting["date_start"].replace("Z", "+00:00")
            )

        circuit_key = meeting.get("circuit_key")
        existing = db.query(CalendarEvent).filter(CalendarEvent.meeting_key == meeting_key).first()
        if existing:
            existing.year = year
            existing.round_number = round_num
            existing.meeting_name = meeting.get("meeting_official_name", name)
            existing.circuit_key = circuit_key
            existing.circuit_short_name = meeting.get("circuit_short_name")
            existing.country_name = meeting.get("country_name")
            existing.date_start = date_start
            existing.is_cancelled = meeting.get("is_cancelled", False)
            existing.openf1_circuit_image_url = meeting.get("circuit_image")
            existing.circuit_map_path = (
                f"/images/circuits/{circuit_key}.svg" if circuit_key else None
            )
        else:
            db.add(
                CalendarEvent(
                    meeting_key=meeting_key,
                    year=year,
                    round_number=round_num,
                    meeting_name=meeting.get("meeting_official_name", name),
                    circuit_key=circuit_key,
                    circuit_short_name=meeting.get("circuit_short_name"),
                    country_name=meeting.get("country_name"),
                    date_start=date_start,
                    is_cancelled=meeting.get("is_cancelled", False),
                    openf1_circuit_image_url=meeting.get("circuit_image"),
                    circuit_map_path=(
                        f"/images/circuits/{circuit_key}.svg" if circuit_key else None
                    ),
                )
            )
        count += 1

    db.commit()
    return count


def get_calendar(db: Session, year: int) -> list[CalendarEvent]:
    events = (
        db.query(CalendarEvent)
        .filter(CalendarEvent.year == year, CalendarEvent.is_cancelled.is_(False))
        .order_by(CalendarEvent.round_number)
        .all()
    )
    return events


def fallback_calendar_2026(db: Session) -> list[CalendarEvent]:
    """Seed from 2025 structure if 2026 not available."""
    existing = get_calendar(db, 2026)
    if existing:
        return existing

    events_2025 = get_calendar(db, 2025)
    if events_2025:
        cloned: list[CalendarEvent] = []
        for ev in events_2025:
            cloned.append(
                CalendarEvent(
                    meeting_key=ev.meeting_key + 10000,
                    year=2026,
                    round_number=ev.round_number,
                    meeting_name=ev.meeting_name.replace("2025", "2026"),
                    circuit_key=ev.circuit_key,
                    circuit_short_name=ev.circuit_short_name,
                    country_name=ev.country_name,
                    date_start=ev.date_start,
                    is_cancelled=False,
                    circuit_map_path=ev.circuit_map_path,
                    openf1_circuit_image_url=ev.openf1_circuit_image_url,
                )
            )
        for c in cloned:
            db.merge(c)
        db.commit()
        return cloned

    return []


REAL_GRID_2026 = [
    ("McLaren", 4, "Lando Norris", "mclaren"),
    ("McLaren", 81, "Oscar Piastri", "mclaren"),
    ("Mercedes", 63, "George Russell", "mercedes"),
    ("Mercedes", 12, "Andrea Kimi Antonelli", "mercedes"),
    ("Red Bull", 1, "Max Verstappen", "red-bull"),
    ("Red Bull", 22, "Yuki Tsunoda", "red-bull"),
    ("Ferrari", 16, "Charles Leclerc", "ferrari"),
    ("Ferrari", 44, "Lewis Hamilton", "ferrari"),
    ("Williams", 23, "Alexander Albon", "williams"),
    ("Williams", 55, "Carlos Sainz", "williams"),
    ("Racing Bulls", 6, "Isack Hadjar", "rb"),
    ("Racing Bulls", 30, "Liam Lawson", "rb"),
    ("Aston Martin", 14, "Fernando Alonso", "aston-martin"),
    ("Aston Martin", 18, "Lance Stroll", "aston-martin"),
    ("Haas", 31, "Esteban Ocon", "haas"),
    ("Haas", 87, "Oliver Bearman", "haas"),
    ("Audi", 5, "Gabriel Bortoleto", "sauber"),
    ("Audi", 27, "Nico Hulkenberg", "sauber"),
    ("Alpine", 10, "Pierre Gasly", "alpine"),
    ("Alpine", 43, "Franco Colapinto", "alpine"),
    ("Cadillac", 11, "Sergio Perez", "cadillac"),
    ("Cadillac", 77, "Valtteri Bottas", "cadillac"),
]


def sync_real_grid(db: Session) -> int:
    from app.models.constructor import Constructor
    from app.models.driver import Driver

    db.query(RealGridEntry).delete()

    for team_name, number, driver_name, constructor_slug in REAL_GRID_2026:
        driver = (
            db.query(Driver)
            .filter(Driver.display_name.ilike(f"%{driver_name.split()[-1]}%"))
            .first()
        )
        constructor = db.query(Constructor).filter(Constructor.slug == constructor_slug).first()
        db.add(
            RealGridEntry(
                team_name=team_name,
                driver_number=number,
                driver_name=driver_name,
                driver_entity_id=driver.id if driver else None,
                constructor_entity_id=constructor.id if constructor else None,
                constructor_name=constructor.display_name if constructor else team_name,
            )
        )

    db.commit()
    return len(REAL_GRID_2026)
