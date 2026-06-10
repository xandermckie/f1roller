"""Build curated draw packets for hybrid 16Wins-style team building."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Literal

from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from app.models.roster_entry import RosterEntry
from app.schemas.common import DrawResponse, RosterEntity, SlotId
from app.services.roster_builder import (
    DECADES,
    build_roster,
    roll_team,
    team_display_name,
)

GameMode = Literal["historical", "2026"]

CURRENT_GRID_SLUGS: list[str] = [
    "alpine",
    "aston-martin",
    "cadillac",
    "ferrari",
    "haas",
    "mclaren",
    "mercedes",
    "rb",
    "red-bull",
    "sauber",
    "williams",
]

SEASON_DECADE_2026 = "2020s"
MAX_PACKET_SIZE = 8

COSMETIC_SLOTS: set[str] = {
    "title_sponsor",
    "secondary_sponsor",
    "livery_style",
    "team_motto",
}

SLOT_PRIORITY: list[SlotId] = [
    "driver_1",
    "driver_2",
    "reserve_driver",
    "constructor",
    "engine",
    "team_principal",
    "technical_director",
    "lead_engineer",
    "title_sponsor",
    "secondary_sponsor",
    "livery_style",
    "team_motto",
]

_SEASON_PACKS_PATH = Path(__file__).resolve().parents[2] / "data" / "season_packs_2026.json"


def _seeded_rng(session_seed: str, salt: str) -> random.Random:
    return random.Random(f"{session_seed}:{salt}")


def _load_season_packs() -> dict[str, dict[str, str]]:
    if not _SEASON_PACKS_PATH.exists():
        return {}
    with _SEASON_PACKS_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def _allowed_team_slugs(db: Session, game_mode: GameMode) -> list[str] | None:
    if game_mode != "2026":
        return None
    available = {
        row[0]
        for row in db.execute(select(distinct(RosterEntry.team_slug))).all()
        if row[0]
    }
    return [slug for slug in CURRENT_GRID_SLUGS if slug in available]


def _roll_team_for_mode(
    db: Session,
    session_seed: str,
    game_mode: GameMode,
    excluded_team_slugs: list[str] | None,
    reroll_salt: str | None,
    round_index: int,
) -> tuple[str, str]:
    allowed = _allowed_team_slugs(db, game_mode)
    excluded = set(excluded_team_slugs or [])
    if allowed:
        candidates = [slug for slug in allowed if slug not in excluded]
        if not candidates:
            candidates = allowed
        salt = f"team:{round_index}:{reroll_salt or 'initial'}"
        chosen = _seeded_rng(session_seed, salt).choice(candidates)
        return chosen, team_display_name(chosen)
    return roll_team(db, session_seed, list(excluded), reroll_salt)


def _resolve_decade(
    db: Session,
    session_seed: str,
    team_slug: str,
    game_mode: GameMode,
    reroll_salt: str | None,
    round_index: int,
) -> str:
    packs = _load_season_packs()
    if game_mode == "2026":
        pack = packs.get(team_slug)
        if pack and pack.get("decade"):
            return pack["decade"]
        decades = [
            row[0]
            for row in db.execute(
                select(distinct(RosterEntry.decade)).where(RosterEntry.team_slug == team_slug)
            ).all()
        ]
        if SEASON_DECADE_2026 in decades:
            return SEASON_DECADE_2026
        if decades:
            return sorted(decades, key=lambda d: DECADES.index(d) if d in DECADES else 99)[-1]
    salt = f"decade:{round_index}:{reroll_salt or 'initial'}"
    decades = [
        row[0]
        for row in db.execute(
            select(distinct(RosterEntry.decade)).where(RosterEntry.team_slug == team_slug)
        ).all()
    ]
    if not decades:
        raise ValueError(f"No decades available for team: {team_slug}")
    return _seeded_rng(session_seed, salt).choice(
        sorted(decades, key=lambda d: DECADES.index(d) if d in DECADES else 99)
    )


def _pick_for_slot(
    entities: list[RosterEntity],
    slot: SlotId,
    rng: random.Random,
) -> RosterEntity | None:
    eligible = [entity for entity in entities if slot in entity.assignable_slots]
    if not eligible:
        return None
    if slot in COSMETIC_SLOTS:
        ranked = sorted(eligible, key=lambda e: e.computed_rating or 0, reverse=True)
        shortlist = ranked[: min(3, len(ranked))]
        return rng.choice(shortlist)
    return max(eligible, key=lambda e: e.computed_rating or 0)


def _apply_pack_overrides(
    packet: list[RosterEntity],
    roster_entities: list[RosterEntity],
    team_slug: str,
    empty_slots: list[SlotId],
    game_mode: GameMode,
) -> list[RosterEntity]:
    if game_mode != "2026":
        return packet
    pack = _load_season_packs().get(team_slug)
    if not pack:
        return packet
    by_slug = {entity.slug: entity for entity in roster_entities}
    replaced: dict[str, RosterEntity] = {entity.id: entity for entity in packet}
    for slot in empty_slots:
        slug = pack.get(slot)
        if slug and slug in by_slug:
            replaced[by_slug[slug].id] = by_slug[slug]
    return list(replaced.values())


def build_draw_packet(
    db: Session,
    *,
    session_seed: str,
    game_mode: GameMode,
    empty_slots: list[SlotId],
    round_index: int,
    excluded_team_slugs: list[str] | None = None,
    reroll_salt: str | None = None,
) -> DrawResponse:
    team_slug, team_name = _roll_team_for_mode(
        db,
        session_seed,
        game_mode,
        excluded_team_slugs,
        reroll_salt,
        round_index,
    )
    decade = _resolve_decade(db, session_seed, team_slug, game_mode, reroll_salt, round_index)
    roster = build_roster(db, team_slug, decade)

    prioritized_slots = [slot for slot in SLOT_PRIORITY if slot in empty_slots]
    rng = _seeded_rng(session_seed, f"packet:{round_index}:{reroll_salt or 'initial'}")

    packet: list[RosterEntity] = []
    seen_ids: set[str] = set()
    for slot in prioritized_slots:
        entity = _pick_for_slot(roster.entities, slot, rng)
        if entity and entity.id not in seen_ids:
            packet.append(entity)
            seen_ids.add(entity.id)

    packet = _apply_pack_overrides(packet, roster.entities, team_slug, prioritized_slots, game_mode)
    packet = packet[:MAX_PACKET_SIZE]
    rng.shuffle(packet)

    return DrawResponse(
        team_slug=team_slug,
        team_display_name=team_name,
        decade=decade,
        draw_packet=packet,
        pool_warnings=roster.pool_warnings,
    )
