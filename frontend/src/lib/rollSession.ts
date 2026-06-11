import type {
  CareerStats,
  DrawResponse,
  GameMode,
  RollSession,
  RosterEntity,
  SeasonSummary,
  SimResult,
  SlotId,
  TeamPayload,
} from "@/types";
import { SLOT_ORDER } from "@/types";

const STORAGE_KEY = "f1roller_roll_session";
export const SESSION_VERSION = 7;
export const MAX_SEASON_ROUNDS = 16;

export function createDefaultSimProgress(): RollSession["simProgress"] {
  return {
    phase: "building",
    currentRound: 0,
    revealedRaces: [],
    maxRounds: MAX_SEASON_ROUNDS,
  };
}

export function createSession(gameMode: GameMode = "historical"): RollSession {
  return {
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    phase: "setup",
    sessionSeed: crypto.randomUUID(),
    sessionVersion: SESSION_VERSION,
    gameMode,
    currentSlotIndex: 0,
    drawPacket: [],
    rosterPool: [],
    assignedEntities: {},
    assignments: {},
    drawRerollRemaining: 1,
    simProgress: createDefaultSimProgress(),
  };
}

export function normalizeSession(session: RollSession): RollSession {
  const drawPacket = session.drawPacket ?? session.rosterPool ?? [];
  return {
    ...session,
    gameMode: session.gameMode ?? "historical",
    drawPacket,
    rosterPool: drawPacket,
    assignedEntities: session.assignedEntities ?? {},
    assignments: session.assignments ?? {},
    drawRerollRemaining:
      typeof session.drawRerollRemaining === "number" ? session.drawRerollRemaining : 1,
    currentSlotIndex:
      typeof session.currentSlotIndex === "number" ? session.currentSlotIndex : 0,
    simProgress: session.simProgress ?? createDefaultSimProgress(),
  };
}

export function loadSession(): RollSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as RollSession;
    if (session.sessionVersion !== SESSION_VERSION) return null;
    return normalizeSession(session);
  } catch {
    return null;
  }
}

export function saveSession(session: RollSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function getActivePool(session: RollSession): RosterEntity[] {
  return session.drawPacket.length > 0 ? session.drawPacket : session.rosterPool;
}

export function getCurrentSlot(session: RollSession): SlotId {
  const slot = SLOT_ORDER[session.currentSlotIndex];
  return slot ?? "driver_1";
}

export function isSlotFilled(session: RollSession, slotId: SlotId): boolean {
  return Object.hasOwn(session.assignments, slotId) && Boolean(session.assignments[slotId]);
}

export function getNextEmptySlotIndex(session: RollSession): number | null {
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const slotId = SLOT_ORDER[i];
    if (slotId && !isSlotFilled(session, slotId)) {
      return i;
    }
  }
  return null;
}

export function isRoundRolled(session: RollSession): boolean {
  return Boolean(session.rolledTeam && session.rolledDecade && getActivePool(session).length > 0);
}

export function syncCurrentSlotIndex(session: RollSession): RollSession {
  const next = getNextEmptySlotIndex(session);
  if (next === null) {
    return { ...session, currentSlotIndex: SLOT_ORDER.length - 1 };
  }
  return { ...session, currentSlotIndex: next };
}

export function needsRosterRecovery(session: RollSession, isLoading = false): boolean {
  return (
    !isLoading &&
    Boolean(session.rolledTeam && session.rolledDecade) &&
    getActivePool(session).length === 0 &&
    !isAssignmentComplete(session)
  );
}

export function hasActiveRound(session: RollSession): boolean {
  if (needsRosterRecovery(session)) {
    return false;
  }
  return isRoundRolled(session) && !isAssignmentComplete(session);
}

export function applyDrawResponse(session: RollSession, draw: DrawResponse): RollSession {
  return syncCurrentSlotIndex({
    ...session,
    rolledTeam: { slug: draw.team_slug, display_name: draw.team_display_name },
    rolledDecade: draw.decade,
    drawPacket: draw.draw_packet,
    rosterPool: draw.draw_packet,
    poolWarnings: draw.pool_warnings,
    drawRerollRemaining: 1,
    phase: "assigning",
  });
}

export function isRoundReady(session: RollSession): boolean {
  return isRoundRolled(session);
}

export function canAdvanceRound(session: RollSession): boolean {
  const slot = getCurrentSlot(session);
  return isSlotFilled(session, slot);
}

export function isSetupComplete(session: RollSession): boolean {
  return isAssignmentComplete(session);
}

export function isAssignmentComplete(session: RollSession): boolean {
  return SLOT_ORDER.every((slot) => isSlotFilled(session, slot));
}

export function getPoolEntity(
  session: RollSession,
  entityId: string,
): RosterEntity | undefined {
  const pool = getActivePool(session);
  return (
    pool.find((entity) => entity.id === entityId) ??
    session.assignedEntities?.[entityId]
  );
}

export function getAssignedEntity(
  session: RollSession,
  slotId: SlotId,
): RosterEntity | undefined {
  const entityId = session.assignments[slotId];
  if (!entityId) return undefined;
  return getPoolEntity(session, entityId);
}

export function getAssignedEntityIds(session: RollSession): Set<string> {
  return new Set(
    SLOT_ORDER.filter((slot) => isSlotFilled(session, slot))
      .map((slot) => session.assignments[slot])
      .filter(Boolean) as string[],
  );
}

export function getEligibleForSlot(session: RollSession, slotId: SlotId): RosterEntity[] {
  const assignedIds = getAssignedEntityIds(session);
  return getActivePool(session).filter(
    (entity) =>
      entity.assignable_slots.includes(slotId) && !assignedIds.has(entity.id),
  );
}

export function getAvailablePool(session: RollSession): RosterEntity[] {
  const assignedIds = getAssignedEntityIds(session);
  return getActivePool(session).filter((entity) => !assignedIds.has(entity.id));
}

export function getEmptySlots(session: RollSession): SlotId[] {
  return SLOT_ORDER.filter((slot) => !isSlotFilled(session, slot));
}

export function getAssignablePool(session: RollSession): RosterEntity[] {
  const emptySlots = getEmptySlots(session);
  const assignedIds = getAssignedEntityIds(session);
  return getActivePool(session).filter(
    (entity) =>
      !assignedIds.has(entity.id) &&
      entity.assignable_slots.some((slot) => emptySlots.includes(slot)),
  );
}

export function isEntityAssignable(session: RollSession, entity: RosterEntity): boolean {
  const emptySlots = getEmptySlots(session);
  return entity.assignable_slots.some((slot) => emptySlots.includes(slot));
}

export function canAssignEntityToSlot(
  session: RollSession,
  entity: RosterEntity,
  slotId: SlotId,
): boolean {
  return !isSlotFilled(session, slotId) && canAssign(entity, slotId);
}

export function canAssign(entity: RosterEntity, slotId: SlotId): boolean {
  return entity.assignable_slots.includes(slotId);
}

export function countFilledSlots(session: RollSession): number {
  return SLOT_ORDER.filter((slot) => isSlotFilled(session, slot)).length;
}

export function clearPerRoundState(session: RollSession): RollSession {
  return {
    ...session,
    rolledTeam: undefined,
    rolledDecade: undefined,
    drawPacket: [],
    rosterPool: [],
    poolWarnings: undefined,
  };
}

export function buildTeamPayload(session: RollSession): TeamPayload | null {
  if (!isAssignmentComplete(session)) {
    return null;
  }

  const getId = (slot: SlotId): string | null => session.assignments[slot] ?? null;
  const getEntity = (slot: SlotId): RosterEntity | undefined => getAssignedEntity(session, slot);

  const driver1Id = getId("driver_1");
  const driver2Id = getId("driver_2");
  const reserveId = getId("reserve_driver");
  const constructorId = getId("constructor");
  const engineId = getId("engine");
  const tpId = getId("team_principal");
  const tdId = getId("technical_director");
  const engineerId = getId("lead_engineer");
  const titleId = getId("title_sponsor");
  const secondaryId = getId("secondary_sponsor");
  const livery = getEntity("livery_style");
  const motto = getEntity("team_motto");

  if (
    !driver1Id ||
    !driver2Id ||
    !reserveId ||
    !constructorId ||
    !engineId ||
    !tpId ||
    !tdId ||
    !engineerId ||
    !titleId ||
    !secondaryId ||
    !livery ||
    !motto
  ) {
    return null;
  }

  return {
    driver_1_id: driver1Id,
    driver_2_id: driver2Id,
    reserve_driver_id: reserveId,
    constructor_id: constructorId,
    engine_id: engineId,
    team_principal_id: tpId,
    technical_director_id: tdId,
    lead_engineer_id: engineerId,
    title_sponsor_id: titleId,
    secondary_sponsor_id: secondaryId,
    livery_style: livery.slug,
    team_motto: motto.display_name,
  };
}

export function mergeSimResult(session: RollSession, result: SimResult): RollSession {
  return {
    ...session,
    simResult: result,
    simProgress: {
      phase: "complete",
      currentRound: result.races.length,
      revealedRaces: result.races,
      maxRounds: MAX_SEASON_ROUNDS,
    },
    phase: "complete",
  };
}

// ── Career helpers ────────────────────────────────────────────────────────────

export function defaultCareer(): CareerStats {
  return {
    seasons: 0,
    totalWins: 0,
    bestWdcPosition: null,
    bestWccPosition: null,
    totalWdcPoints: 0,
    totalWccPoints: 0,
    seasonHistory: [],
  };
}

export function recordSeasonIntoCareer(
  career: CareerStats,
  result: SimResult,
  seasonNumber: number,
): CareerStats {
  const summary = result.user_summary;
  const wdcPoints = result.final_wdc.find((e) => e.is_user)?.points ?? 0;
  const wccPoints = result.final_wcc.find((e) => e.is_user)?.points ?? 0;

  const seasonSummary: SeasonSummary = {
    season: seasonNumber,
    wins: summary.wins,
    wdcPosition: summary.wdc_position,
    wccPosition: summary.wcc_position,
    wdcPoints,
    wccPoints,
    teamEfficiencyPct: summary.team_efficiency_pct ?? null,
  };

  return {
    seasons: career.seasons + 1,
    totalWins: career.totalWins + summary.wins,
    bestWdcPosition:
      career.bestWdcPosition === null
        ? summary.wdc_position
        : Math.min(career.bestWdcPosition, summary.wdc_position),
    bestWccPosition:
      career.bestWccPosition === null
        ? summary.wcc_position
        : Math.min(career.bestWccPosition, summary.wcc_position),
    totalWdcPoints: career.totalWdcPoints + wdcPoints,
    totalWccPoints: career.totalWccPoints + wccPoints,
    seasonHistory: [...career.seasonHistory, seasonSummary],
  };
}

/**
 * Advance to the next season: preserve team + career, reset sim state.
 * Called after the user clicks "Continue to Season N+1".
 */
export function advanceToNextSeason(session: RollSession): RollSession {
  if (!session.simResult) return session;

  const prevCareer = session.career ?? defaultCareer();
  const currentSeasonNumber = prevCareer.seasons + 1;
  const updatedCareer = recordSeasonIntoCareer(prevCareer, session.simResult, currentSeasonNumber);

  return {
    ...session,
    sessionSeed: crypto.randomUUID(), // fresh seed so races differ
    phase: "simulating", // team stays built — skip straight to simulation phase
    simResult: undefined,
    simProgress: createDefaultSimProgress(),
    career: updatedCareer,
    tradesUsed: 0,
    // Keep: assignments, assignedEntities, teamPayload, gameMode
    // Clear draw packet (not relevant between seasons)
    rolledTeam: undefined,
    rolledDecade: undefined,
    drawPacket: [],
    rosterPool: [],
    poolWarnings: undefined,
  };
}

export function applyTransfer(
  session: RollSession,
  slotId: SlotId,
  incomingEntity: RosterEntity,
): RollSession {
  const outgoingId = session.assignments[slotId];
  const assignedEntities = { ...session.assignedEntities };

  // Remove outgoing entity from the entity map
  if (outgoingId) {
    delete assignedEntities[outgoingId];
  }

  // Register the incoming entity
  assignedEntities[incomingEntity.id] = incomingEntity;

  const updated: RollSession = {
    ...session,
    assignments: { ...session.assignments, [slotId]: incomingEntity.id },
    assignedEntities,
    teamPayload: undefined, // will be rebuilt on next simulate
    tradesUsed: (session.tradesUsed ?? 0) + 1,
  };

  return syncCurrentSlotIndex(updated);
}

export function appendRaceResult(session: RollSession, race: SimResult["races"][number]): RollSession {
  const revealedRaces = [...session.simProgress.revealedRaces, race];
  const wins = revealedRaces.filter((item) => item.user_race_points >= 25).length;
  const isComplete = revealedRaces.length >= session.simProgress.maxRounds;
  return {
    ...session,
    simProgress: {
      ...session.simProgress,
      phase: isComplete ? "complete" : "racing",
      currentRound: revealedRaces.length,
      revealedRaces,
    },
    simResult: isComplete
      ? {
          races: revealedRaces,
          final_wdc: session.simResult?.final_wdc ?? [],
          final_wcc: session.simResult?.final_wcc ?? [],
          user_summary: {
            wdc_position: session.simResult?.user_summary.wdc_position ?? 0,
            wcc_position: session.simResult?.user_summary.wcc_position ?? 0,
            wins,
            poles: 0,
            team_efficiency_pct: session.simResult?.user_summary.team_efficiency_pct,
          },
          session_seed: session.sessionSeed,
        }
      : session.simResult,
  };
}
