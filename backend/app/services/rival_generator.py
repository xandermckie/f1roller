"""Generate 19 mixed-era rival teams."""

from __future__ import annotations

import hashlib
import random
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.constructor import Constructor
from app.models.driver import Driver
from app.models.engine_entity import EngineEntity
from app.models.personnel import Personnel
from app.services.synergy import EntityRef
from app.services.team_pace import TeamEntities


def _seeded_rng(team_ids: list[str], salt: int) -> random.Random:
    digest = hashlib.sha256(f"{':'.join(sorted(team_ids))}:{salt}".encode()).hexdigest()
    return random.Random(int(digest[:16], 16))


def _to_entity_ref(driver: Driver) -> EntityRef:
    return EntityRef(
        slug=driver.slug,
        display_name=driver.display_name,
        peak_year=driver.peak_year,
        teams_history=driver.teams_history or [],
    )


def generate_rivals(
    db: Session,
    user_driver_ids: list[UUID],
    count: int = 19,
) -> list[TeamEntities]:
    constructors = db.query(Constructor).order_by(Constructor.computed_rating.desc()).all()
    engines = db.query(EngineEntity).order_by(EngineEntity.computed_rating.desc()).all()
    drivers = (
        db.query(Driver)
        .filter(Driver.computed_rating > 0)
        .order_by(Driver.computed_rating.desc())
        .limit(120)
        .all()
    )
    personnel = db.query(Personnel).all()

    tps = [p for p in personnel if p.role == "team_principal"]
    tds = [p for p in personnel if p.role == "technical_director"]
    engineers = [p for p in personnel if p.role == "lead_engineer"]

    excluded = set(str(i) for i in user_driver_ids)
    used_drivers: set[str] = set(excluded)

    rivals: list[TeamEntities] = []
    team_ids = [str(i) for i in user_driver_ids]

    for i in range(count):
        rng = _seeded_rng(team_ids, i)

        constructor = rng.choice(constructors)
        engine = rng.choice(engines)

        available = [d for d in drivers if str(d.id) not in used_drivers]
        if len(available) < 3:
            used_drivers -= excluded
            available = [d for d in drivers if str(d.id) not in used_drivers]

        selected = rng.sample(available, min(3, len(available)))
        for d in selected:
            used_drivers.add(str(d.id))

        d1, d2, reserve = selected[0], selected[1], selected[2]
        tp = rng.choice(tps) if tps else personnel[0]
        td = rng.choice(tds) if tds else personnel[0]
        eng = rng.choice(engineers) if engineers else personnel[0]

        team_name = f"{constructor.display_name} {engine.display_name} Racing"

        rivals.append(
            TeamEntities(
                driver_1_rating=d1.computed_rating,
                driver_2_rating=d2.computed_rating,
                reserve_rating=reserve.computed_rating,
                constructor_rating=constructor.computed_rating,
                engine_rating=engine.computed_rating,
                tp_rating=tp.computed_rating,
                td_rating=td.computed_rating,
                engineer_rating=eng.computed_rating,
                driver_1=_to_entity_ref(d1),
                driver_2=_to_entity_ref(d2),
                reserve=_to_entity_ref(reserve),
                constructor_slug=constructor.slug,
                engine_slug=engine.slug,
                tp_slug=tp.slug,
                engineer_slug=eng.slug,
                team_name=team_name,
            )
        )

    return rivals
