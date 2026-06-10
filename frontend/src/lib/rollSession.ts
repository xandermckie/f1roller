import type { RosterResponse, RollSession, RosterEntity, SlotId, TeamPayload } from "@/types";
import { SLOT_ORDER } from "@/types";

const STORAGE_KEY = "f1roller_roll_session";
export const SESSION_VERSION = 6;

export function createSession(): RollSession {
  return {
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    phase: "setup",
    sessionSeed: crypto.randomUUID(),
    sessionVersion: SESSION_VERSION,
    currentSlotIndex: 0,
    rosterPool: [],
    assignedEntities: {},
    assignments: {},
    rerollsRemaining: { team: 1, decade: 1 },
  };
}

export function normalizeSession(session: RollSession): RollSession {
  return {
    ...session,
    rosterPool: session.rosterPool ?? [],
    assignedEntities: session.assignedEntities ?? {},
    assignments: session.assignments ?? {},
    rerollsRemaining: session.rerollsRemaining ?? { team: 1, decade: 1 },
    currentSlotIndex:
      typeof session.currentSlotIndex === "number" ? session.currentSlotIndex : 0,
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
  return Boolean(session.rolledTeam && session.rolledDecade);
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
    isRoundRolled(session) &&
    session.rosterPool.length === 0 &&
    !isAssignmentComplete(session)
  );
}

export function hasActiveRound(session: RollSession): boolean {
  if (needsRosterRecovery(session)) {
    return false;
  }
  return isRoundRolled(session) && !isAssignmentComplete(session);
}

export function applyRosterResponse(
  session: RollSession,
  roster: RosterResponse,
): RollSession {
  return syncCurrentSlotIndex({
    ...session,
    rosterPool: roster.entities,
    poolWarnings: roster.pool_warnings,
    phase: "assigning",
  });
}

export function isRoundReady(session: RollSession): boolean {
  return isRoundRolled(session) && session.rosterPool.length > 0;
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
  return session.rosterPool.find((entity) => entity.id === entityId);
}

export function getAssignedEntity(
  session: RollSession,
  slotId: SlotId,
): RosterEntity | undefined {
  const entityId = session.assignments[slotId];
  if (!entityId) return undefined;
  return (
    session.rosterPool.find((entity) => entity.id === entityId) ??
    session.assignedEntities?.[entityId]
  );
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
  return session.rosterPool.filter(
    (entity) =>
      entity.assignable_slots.includes(slotId) && !assignedIds.has(entity.id),
  );
}

export function getAvailablePool(session: RollSession): RosterEntity[] {
  const assignedIds = getAssignedEntityIds(session);
  return session.rosterPool.filter((entity) => !assignedIds.has(entity.id));
}

export function getEmptySlots(session: RollSession): SlotId[] {
  return SLOT_ORDER.filter((slot) => !isSlotFilled(session, slot));
}

export function getAssignablePool(session: RollSession): RosterEntity[] {
  const emptySlots = getEmptySlots(session);
  const assignedIds = getAssignedEntityIds(session);
  return session.rosterPool.filter(
    (entity) =>
      !assignedIds.has(entity.id) &&
      entity.assignable_slots.some((slot) => emptySlots.includes(slot)),
  );
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
