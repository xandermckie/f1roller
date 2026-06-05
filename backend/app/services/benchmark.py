"""Best possible team via greedy + beam search."""

from __future__ import annotations

from itertools import product

from sqlalchemy.orm import Session

from app.models.benchmark_team import BenchmarkTeam
from app.models.constructor import Constructor
from app.models.driver import Driver
from app.models.engine_entity import EngineEntity
from app.models.personnel import Personnel
from app.schemas.common import TeamPayload
from app.services.synergy import EntityRef
from app.services.team_pace import TeamEntities, compute_team_pace


BEAM_WIDTH = 8
SEARCH_DEPTH = 3


def _driver_ref(d: Driver) -> EntityRef:
    return EntityRef(d.slug, d.display_name, d.peak_year, d.teams_history or [])


def _evaluate_combo(
    d1: Driver,
    d2: Driver,
    reserve: Driver,
    constructor: Constructor,
    engine: EngineEntity,
    tp: Personnel,
    td: Personnel,
    engineer: Personnel,
) -> tuple[float, TeamEntities]:
    entities = TeamEntities(
        driver_1_rating=d1.computed_rating,
        driver_2_rating=d2.computed_rating,
        reserve_rating=reserve.computed_rating,
        constructor_rating=constructor.computed_rating,
        engine_rating=engine.computed_rating,
        tp_rating=tp.computed_rating,
        td_rating=td.computed_rating,
        engineer_rating=engineer.computed_rating,
        driver_1=_driver_ref(d1),
        driver_2=_driver_ref(d2),
        reserve=_driver_ref(reserve),
        constructor_slug=constructor.slug,
        engine_slug=engine.slug,
        tp_slug=tp.slug,
        engineer_slug=engineer.slug,
        team_name="Benchmark Team",
    )
    pace, _, _ = compute_team_pace(entities)
    return pace, entities


def compute_benchmark(db: Session) -> tuple[TeamPayload, float, TeamEntities]:
    top_drivers = db.query(Driver).order_by(Driver.computed_rating.desc()).limit(40).all()
    top_constructors = db.query(Constructor).order_by(Constructor.computed_rating.desc()).limit(20).all()
    top_engines = db.query(EngineEntity).order_by(EngineEntity.computed_rating.desc()).limit(15).all()
    tps = (
        db.query(Personnel)
        .filter(Personnel.role == "team_principal")
        .order_by(Personnel.computed_rating.desc())
        .limit(10)
        .all()
    )
    tds = (
        db.query(Personnel)
        .filter(Personnel.role == "technical_director")
        .order_by(Personnel.computed_rating.desc())
        .limit(10)
        .all()
    )
    engineers = (
        db.query(Personnel)
        .filter(Personnel.role == "lead_engineer")
        .order_by(Personnel.computed_rating.desc())
        .limit(10)
        .all()
    )

    best_pace = -1.0
    best_entities: TeamEntities | None = None

    # Greedy seed: top 1 each
    greedy_pace, greedy_entities = _evaluate_combo(
        top_drivers[0],
        top_drivers[1],
        top_drivers[2],
        top_constructors[0],
        top_engines[0],
        tps[0],
        tds[0],
        engineers[0],
    )
    best_pace = greedy_pace
    best_entities = greedy_entities

    # Beam search over top drivers/constructor/engine swaps
    driver_triples = list(product(top_drivers[:8], repeat=3))[:64]
    constructor_opts = top_constructors[:8]
    engine_opts = top_engines[:8]

    candidates: list[tuple[float, TeamEntities]] = [(greedy_pace, greedy_entities)]

    for d1, d2, reserve in driver_triples:
        if len({d1.id, d2.id, reserve.id}) < 3:
            continue
        for constructor in constructor_opts:
            for engine in engine_opts:
                pace, entities = _evaluate_combo(
                    d1, d2, reserve, constructor, engine, tps[0], tds[0], engineers[0]
                )
                candidates.append((pace, entities))

    candidates.sort(key=lambda x: x[0], reverse=True)
    top_candidates = candidates[:BEAM_WIDTH]

    for pace, entities in top_candidates:
        for tp in tps[:SEARCH_DEPTH]:
            for eng in engineers[:SEARCH_DEPTH]:
                d1 = next(d for d in top_drivers if d.slug == entities.driver_1.slug)
                d2 = next(d for d in top_drivers if d.slug == entities.driver_2.slug)
                reserve = next(d for d in top_drivers if d.slug == entities.reserve.slug)
                constructor = next(
                    c for c in top_constructors if c.slug == entities.constructor_slug
                )
                engine = next(e for e in top_engines if e.slug == entities.engine_slug)
                td = tds[0]
                new_pace, new_entities = _evaluate_combo(
                    d1, d2, reserve, constructor, engine, tp, td, eng
                )
                if new_pace > best_pace:
                    best_pace = new_pace
                    best_entities = new_entities

    assert best_entities is not None

    # Find entity IDs for payload
    def find_driver(slug: str) -> Driver:
        return db.query(Driver).filter(Driver.slug == slug).one()

    def find_constructor(slug: str) -> Constructor:
        return db.query(Constructor).filter(Constructor.slug == slug).one()

    def find_engine(slug: str) -> EngineEntity:
        return db.query(EngineEntity).filter(EngineEntity.slug == slug).one()

    def find_personnel(slug: str) -> Personnel:
        return db.query(Personnel).filter(Personnel.slug == slug).one()

    d1 = find_driver(best_entities.driver_1.slug)
    d2 = find_driver(best_entities.driver_2.slug)
    reserve = find_driver(best_entities.reserve.slug)
    constructor = find_constructor(best_entities.constructor_slug)
    engine = find_engine(best_entities.engine_slug)
    tp = find_personnel(best_entities.tp_slug)
    td = (
        db.query(Personnel)
        .filter(Personnel.role == "technical_director")
        .order_by(Personnel.computed_rating.desc())
        .first()
    )
    eng = find_personnel(best_entities.engineer_slug)

    from app.models.sponsor import Sponsor

    title = db.query(Sponsor).filter(Sponsor.tier == "title").first()
    secondary = db.query(Sponsor).filter(Sponsor.tier == "secondary").first()

    payload = TeamPayload(
        driver_1_id=str(d1.id),
        driver_2_id=str(d2.id),
        reserve_driver_id=str(reserve.id),
        constructor_id=str(constructor.id),
        engine_id=str(engine.id),
        team_principal_id=str(tp.id),
        technical_director_id=str(td.id) if td else str(tp.id),
        lead_engineer_id=str(eng.id),
        title_sponsor_id=str(title.id) if title else str(tp.id),
        secondary_sponsor_id=str(secondary.id) if secondary else str(tp.id),
        livery_style="classic",
        team_motto="Perfection is the goal",
    )

    return payload, best_pace, best_entities


def save_benchmark(db: Session, payload: TeamPayload, pace: float) -> BenchmarkTeam:
    from datetime import datetime, timezone

    row = db.query(BenchmarkTeam).filter(BenchmarkTeam.id == 1).first()
    if not row:
        row = BenchmarkTeam(id=1)
        db.add(row)

    row.slots_json = payload.model_dump()
    row.team_pace = pace
    row.projected_wdc_points = pace * 24 * 8
    row.projected_wcc_points = pace * 24 * 15
    row.computed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row
