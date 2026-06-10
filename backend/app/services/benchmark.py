"""Best possible team via greedy + beam search."""

from __future__ import annotations

from itertools import product

from sqlalchemy.orm import Session

from app.models.benchmark_team import BenchmarkTeam
from app.models.roster_entry import RosterEntry
from app.schemas.common import TeamPayload
from app.services.rival_generator import _best_by_slug
from app.services.synergy import EntityRef
from app.services.team_pace import TeamEntities, compute_team_pace


BEAM_WIDTH = 8
SEARCH_DEPTH = 3


def _driver_ref(entry: RosterEntry) -> EntityRef:
    return EntityRef(entry.slug, entry.display_name, entry.peak_year, entry.teams_history or [])


def _evaluate_combo(
    d1: RosterEntry,
    d2: RosterEntry,
    reserve: RosterEntry,
    chassis: RosterEntry,
    engine: RosterEntry,
    tp: RosterEntry,
    td: RosterEntry,
    engineer: RosterEntry,
) -> tuple[float, TeamEntities]:
    entities = TeamEntities(
        driver_1_rating=d1.computed_rating,
        driver_2_rating=d2.computed_rating,
        reserve_rating=reserve.computed_rating,
        constructor_rating=chassis.computed_rating,
        engine_rating=engine.computed_rating,
        tp_rating=tp.computed_rating,
        td_rating=td.computed_rating,
        engineer_rating=engineer.computed_rating,
        driver_1=_driver_ref(d1),
        driver_2=_driver_ref(d2),
        reserve=_driver_ref(reserve),
        constructor_slug=chassis.slug,
        engine_slug=engine.slug,
        tp_slug=tp.slug,
        engineer_slug=engineer.slug,
        team_name="Benchmark Team",
    )
    pace, _, _ = compute_team_pace(entities)
    return pace, entities


def _find_by_slug(entries: list[RosterEntry], slug: str) -> RosterEntry:
    return next(e for e in entries if e.slug == slug)


def compute_benchmark(db: Session) -> tuple[TeamPayload, float, TeamEntities]:
    all_entries = db.query(RosterEntry).all()
    if not all_entries:
        raise ValueError("Roster data is missing. Import f1roller_roster_master.csv first.")

    top_drivers = sorted(
        _best_by_slug([e for e in all_entries if e.entity_type == "driver"]),
        key=lambda e: e.computed_rating,
        reverse=True,
    )[:40]
    top_chassis = sorted(
        _best_by_slug([e for e in all_entries if e.entity_type == "chassis"]),
        key=lambda e: e.computed_rating,
        reverse=True,
    )[:20]
    top_engines = sorted(
        _best_by_slug([e for e in all_entries if e.entity_type == "engine"]),
        key=lambda e: e.computed_rating,
        reverse=True,
    )[:15]
    tps = sorted(
        [e for e in all_entries if e.entity_type == "personnel" and e.personnel_role == "team_principal"],
        key=lambda e: e.computed_rating,
        reverse=True,
    )[:10]
    tds = sorted(
        [e for e in all_entries if e.entity_type == "personnel" and e.personnel_role == "technical_director"],
        key=lambda e: e.computed_rating,
        reverse=True,
    )[:10]
    engineers = sorted(
        [e for e in all_entries if e.entity_type == "personnel" and e.personnel_role == "lead_engineer"],
        key=lambda e: e.computed_rating,
        reverse=True,
    )[:10]
    if not engineers:
        engineers = tds

    title_sponsors = [e for e in all_entries if e.entity_type == "sponsor" and e.sponsor_tier == "title"]
    secondary_sponsors = [
        e for e in all_entries if e.entity_type == "sponsor" and e.sponsor_tier == "secondary"
    ]
    liveries = [e for e in all_entries if e.entity_type == "livery"]
    mottos = [e for e in all_entries if e.entity_type == "motto"]

    best_pace = -1.0
    best_entities: TeamEntities | None = None

    greedy_pace, greedy_entities = _evaluate_combo(
        top_drivers[0],
        top_drivers[1],
        top_drivers[2],
        top_chassis[0],
        top_engines[0],
        tps[0],
        tds[0],
        engineers[0],
    )
    best_pace = greedy_pace
    best_entities = greedy_entities

    driver_triples = list(product(top_drivers[:8], repeat=3))[:64]
    chassis_opts = top_chassis[:8]
    engine_opts = top_engines[:8]

    candidates: list[tuple[float, TeamEntities]] = [(greedy_pace, greedy_entities)]

    for d1, d2, reserve in driver_triples:
        if len({d1.id, d2.id, reserve.id}) < 3:
            continue
        for chassis in chassis_opts:
            for engine in engine_opts:
                pace, entities = _evaluate_combo(
                    d1, d2, reserve, chassis, engine, tps[0], tds[0], engineers[0]
                )
                candidates.append((pace, entities))

    candidates.sort(key=lambda x: x[0], reverse=True)
    top_candidates = candidates[:BEAM_WIDTH]

    for pace, entities in top_candidates:
        for tp in tps[:SEARCH_DEPTH]:
            for eng in engineers[:SEARCH_DEPTH]:
                d1 = _find_by_slug(top_drivers, entities.driver_1.slug)
                d2 = _find_by_slug(top_drivers, entities.driver_2.slug)
                reserve = _find_by_slug(top_drivers, entities.reserve.slug)
                chassis = _find_by_slug(top_chassis, entities.constructor_slug)
                engine = _find_by_slug(top_engines, entities.engine_slug)
                td = tds[0]
                new_pace, new_entities = _evaluate_combo(
                    d1, d2, reserve, chassis, engine, tp, td, eng
                )
                if new_pace > best_pace:
                    best_pace = new_pace
                    best_entities = new_entities

    assert best_entities is not None

    d1 = _find_by_slug(top_drivers, best_entities.driver_1.slug)
    d2 = _find_by_slug(top_drivers, best_entities.driver_2.slug)
    reserve = _find_by_slug(top_drivers, best_entities.reserve.slug)
    chassis = _find_by_slug(top_chassis, best_entities.constructor_slug)
    engine = _find_by_slug(top_engines, best_entities.engine_slug)
    tp = _find_by_slug(tps, best_entities.tp_slug)
    td = tds[0]
    eng = _find_by_slug(engineers, best_entities.engineer_slug)
    title = title_sponsors[0] if title_sponsors else tp
    secondary = secondary_sponsors[0] if secondary_sponsors else tp
    livery = liveries[0] if liveries else None
    motto = mottos[0] if mottos else None

    payload = TeamPayload(
        driver_1_id=str(d1.id),
        driver_2_id=str(d2.id),
        reserve_driver_id=str(reserve.id),
        constructor_id=str(chassis.id),
        engine_id=str(engine.id),
        team_principal_id=str(tp.id),
        technical_director_id=str(td.id),
        lead_engineer_id=str(eng.id),
        title_sponsor_id=str(title.id),
        secondary_sponsor_id=str(secondary.id),
        livery_style=livery.slug if livery else "classic",
        team_motto=motto.motto_text or motto.display_name if motto else "Perfection is the goal",
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
