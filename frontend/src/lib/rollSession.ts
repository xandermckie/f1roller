import type { RollSession, RolledEntity, SlotId, TeamPayload } from "@/types";
import { SLOT_ORDER } from "@/types";

const STORAGE_KEY = "f1roller_roll_session";
export const SESSION_VERSION = 2;

export function getRoll(session: RollSession, slot: SlotId): RolledEntity | undefined {
  if (!Object.hasOwn(session.rolls, slot)) return undefined;
  return session.rolls[slot];
}

export function createSession(): RollSession {
  return {
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    rolls: {},
    currentSlotIndex: 0,
    driverOrderSwapped: false,
    phase: "rolling",
    sessionSeed: crypto.randomUUID(),
    sessionVersion: SESSION_VERSION,
  };
}

export function loadSession(): RollSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as RollSession;
    if (session.sessionVersion !== SESSION_VERSION) return null;
    return session;
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

export function getExcludedIds(session: RollSession): string[] {
  return SLOT_ORDER.filter((slot) => Object.hasOwn(session.rolls, slot))
    .map((slot) => session.rolls[slot]!.id);
}

export function currentSlot(session: RollSession): SlotId | null {
  if (session.currentSlotIndex >= SLOT_ORDER.length) return null;
  return SLOT_ORDER[session.currentSlotIndex] ?? null;
}

export function isRollComplete(session: RollSession): boolean {
  return SLOT_ORDER.every((slot) => Object.hasOwn(session.rolls, slot));
}

export function buildTeamPayload(session: RollSession): TeamPayload | null {
  const d1 = session.driverOrderSwapped ? getRoll(session, "driver_2") : getRoll(session, "driver_1");
  const d2 = session.driverOrderSwapped ? getRoll(session, "driver_1") : getRoll(session, "driver_2");
  const reserveDriver = getRoll(session, "reserve_driver");
  const constructor = getRoll(session, "constructor");
  const engine = getRoll(session, "engine");
  const teamPrincipal = getRoll(session, "team_principal");
  const technicalDirector = getRoll(session, "technical_director");
  const leadEngineer = getRoll(session, "lead_engineer");
  const titleSponsor = getRoll(session, "title_sponsor");
  const secondarySponsor = getRoll(session, "secondary_sponsor");
  const liveryStyle = getRoll(session, "livery_style");
  const teamMotto = getRoll(session, "team_motto");

  if (
    !d1 ||
    !d2 ||
    !reserveDriver ||
    !constructor ||
    !engine ||
    !teamPrincipal ||
    !technicalDirector ||
    !leadEngineer ||
    !titleSponsor ||
    !secondarySponsor ||
    !liveryStyle ||
    !teamMotto
  ) {
    return null;
  }

  return {
    driver_1_id: d1.id,
    driver_2_id: d2.id,
    reserve_driver_id: reserveDriver.id,
    constructor_id: constructor.id,
    engine_id: engine.id,
    team_principal_id: teamPrincipal.id,
    technical_director_id: technicalDirector.id,
    lead_engineer_id: leadEngineer.id,
    title_sponsor_id: titleSponsor.id,
    secondary_sponsor_id: secondarySponsor.id,
    livery_style: liveryStyle.slug,
    team_motto: teamMotto.display_name,
  };
}

export function advancePhase(session: RollSession): RollSession {
  if (session.currentSlotIndex < SLOT_ORDER.length - 1) {
    return { ...session, currentSlotIndex: session.currentSlotIndex + 1 };
  }
  return { ...session, phase: "assigning" };
}
