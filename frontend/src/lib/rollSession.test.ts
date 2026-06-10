import { describe, expect, it } from "vitest";

import {
  buildTeamPayload,
  canAssign,
  canAssignEntityToSlot,
  canAdvanceRound,
  clearPerRoundState,
  createSession,
  getAssignablePool,
  getAssignedEntity,
  getCurrentSlot,
  getEligibleForSlot,
  hasActiveRound,
  isAssignmentComplete,
  isRoundReady,
  isRoundRolled,
  isSetupComplete,
  isSlotFilled,
  needsRosterRecovery,
  syncCurrentSlotIndex,
} from "@/lib/rollSession";
import type { RosterEntity, SlotId } from "@/types";
import { SLOT_ORDER } from "@/types";

const mockRosterEntity = (
  id: string,
  slots: SlotId[],
  entityType = "driver",
): RosterEntity => ({
  id,
  slug: id,
  display_name: id,
  entity_type: entityType,
  assignable_slots: slots,
  role_label: "Driver",
});

describe("rollSession", () => {
  it("creates session with setup phase and slot index 0", () => {
    const session = createSession();
    expect(session.phase).toBe("setup");
    expect(session.currentSlotIndex).toBe(0);
    expect(session.rerollsRemaining).toEqual({ team: 1, decade: 1 });
    expect(getCurrentSlot(session)).toBe("driver_1");
  });

  it("detects round rolled when team and decade exist", () => {
    const session = createSession();
    expect(isRoundRolled(session)).toBe(false);
    session.rolledTeam = { slug: "mclaren", display_name: "McLaren" };
    session.rolledDecade = "1980s";
    expect(isRoundRolled(session)).toBe(true);
    expect(isRoundReady(session)).toBe(false);
    session.rosterPool = [mockRosterEntity("senna", ["driver_1", "driver_2", "reserve_driver"])];
    expect(isRoundReady(session)).toBe(true);
  });

  it("setup complete means all assignments filled", () => {
    const session = createSession();
    expect(isSetupComplete(session)).toBe(false);
    for (const slot of SLOT_ORDER) {
      session.assignments[slot] = slot;
    }
    expect(isSetupComplete(session)).toBe(true);
  });

  it("filters eligible entities for current slot", () => {
    const session = createSession();
    session.rosterPool = [
      mockRosterEntity("senna", ["driver_1", "driver_2"]),
      mockRosterEntity("tp", ["team_principal"], "personnel"),
    ];
    const eligible = getEligibleForSlot(session, "driver_1");
    expect(eligible).toHaveLength(1);
    expect(eligible[0]?.id).toBe("senna");
  });

  it("excludes already assigned entities from eligible pool", () => {
    const session = createSession();
    session.rosterPool = [
      mockRosterEntity("senna", ["driver_1", "driver_2"]),
      mockRosterEntity("prost", ["driver_1", "driver_2"]),
    ];
    session.assignments.driver_1 = "senna";
    const eligible = getEligibleForSlot(session, "driver_2");
    expect(eligible).toHaveLength(1);
    expect(eligible[0]?.id).toBe("prost");
  });

  it("clears per-round state after assignment", () => {
    const session = createSession();
    session.rolledTeam = { slug: "mclaren", display_name: "McLaren" };
    session.rolledDecade = "1980s";
    session.rosterPool = [mockRosterEntity("senna", ["driver_1"])];
    session.assignments.driver_1 = "senna";
    const cleared = clearPerRoundState(session);
    expect(cleared.rolledTeam).toBeUndefined();
    expect(cleared.rolledDecade).toBeUndefined();
    expect(cleared.rosterPool).toEqual([]);
    expect(cleared.assignments.driver_1).toBe("senna");
  });

  it("detects when current round can advance", () => {
    const session = createSession();
    expect(canAdvanceRound(session)).toBe(false);
    session.assignments.driver_1 = "senna";
    expect(canAdvanceRound(session)).toBe(true);
  });

  it("validates role assignment", () => {
    const driver = mockRosterEntity("d1", ["driver_1", "driver_2", "reserve_driver"]);
    const tp = mockRosterEntity("tp", ["team_principal"], "personnel");
    expect(canAssign(driver, "driver_1")).toBe(true);
    expect(canAssign(driver, "team_principal")).toBe(false);
    expect(canAssign(tp, "team_principal")).toBe(true);
  });

  it("detects incomplete assignments", () => {
    const session = createSession();
    session.rosterPool = SLOT_ORDER.map((slot) =>
      mockRosterEntity(slot, [slot], slot.includes("driver") ? "driver" : slot),
    );
    expect(isAssignmentComplete(session)).toBe(false);
  });

  it("builds team payload when all slots assigned", () => {
    const session = createSession();
    const entities = SLOT_ORDER.map((slot) => {
      const entityType = slot.includes("driver")
        ? "driver"
        : slot === "constructor"
          ? "constructor"
          : slot === "engine"
            ? "engine"
            : slot.includes("sponsor")
              ? "sponsor"
              : slot === "livery_style"
                ? "livery"
                : slot === "team_motto"
                  ? "motto"
                  : "personnel";
      return mockRosterEntity(slot, [slot], entityType);
    });
    session.rosterPool = entities;
    session.assignedEntities = Object.fromEntries(entities.map((e) => [e.id, e]));
    for (const slot of SLOT_ORDER) {
      session.assignments[slot] = slot;
    }
    const payload = buildTeamPayload(session);
    expect(payload).not.toBeNull();
    expect(payload?.driver_1_id).toBe("driver_1");
    expect(payload?.constructor_id).toBe("constructor");
    expect(payload?.livery_style).toBe("livery_style");
    expect(payload?.team_motto).toBe("team_motto");
  });

  it("syncs current slot index to first empty slot", () => {
    const session = createSession();
    session.assignments.driver_1 = "senna";
    session.currentSlotIndex = 0;
    const synced = syncCurrentSlotIndex(session);
    expect(getCurrentSlot(synced)).toBe("driver_2");
  });

  it("detects active round when rolled with roster loaded", () => {
    const session = createSession();
    session.rolledTeam = { slug: "mclaren", display_name: "McLaren" };
    session.rolledDecade = "1980s";
    session.rosterPool = [mockRosterEntity("senna", ["driver_1"])];
    expect(hasActiveRound(session)).toBe(true);
    expect(hasActiveRound(clearPerRoundState(session))).toBe(false);
  });

  it("detects roster recovery when rolled but pool is empty", () => {
    const session = createSession();
    session.rolledTeam = { slug: "mclaren", display_name: "McLaren" };
    session.rolledDecade = "1980s";
    expect(needsRosterRecovery(session)).toBe(true);
    expect(hasActiveRound(session)).toBe(false);
    session.rosterPool = [mockRosterEntity("senna", ["driver_1"])];
    expect(needsRosterRecovery(session)).toBe(false);
    expect(hasActiveRound(session)).toBe(true);
  });

  it("filters assignable pool by empty eligible slots", () => {
    const session = createSession();
    session.rosterPool = [
      mockRosterEntity("senna", ["driver_1", "driver_2"]),
      mockRosterEntity("chassis", ["constructor"], "constructor"),
      mockRosterEntity("tp", ["team_principal"], "personnel"),
    ];
    session.assignments.driver_1 = "senna";
    const pool = getAssignablePool(session);
    expect(pool.map((e) => e.id).sort()).toEqual(["chassis", "tp"]);
    session.assignments.constructor = "chassis";
    const poolAfter = getAssignablePool(session);
    expect(poolAfter.map((e) => e.id)).toEqual(["tp"]);
  });

  it("treats constructor slot as empty when not explicitly assigned", () => {
    const session = createSession();
    expect(isSlotFilled(session, "constructor")).toBe(false);
    expect(getAssignablePool(session)).toEqual([]);
    session.rosterPool = [mockRosterEntity("chassis", ["constructor"], "constructor")];
    expect(getAssignablePool(session).map((e) => e.id)).toEqual(["chassis"]);
  });

  it("blocks assignment to filled slots", () => {
    const session = createSession();
    const driver = mockRosterEntity("prost", ["driver_2"]);
    session.assignments.driver_2 = "senna";
    expect(canAssignEntityToSlot(session, driver, "driver_2")).toBe(false);
    expect(canAssignEntityToSlot(session, driver, "driver_1")).toBe(false);
    delete session.assignments.driver_2;
    expect(canAssignEntityToSlot(session, driver, "driver_2")).toBe(true);
  });

  it("reads assigned entities from assignedEntities cache", () => {
    const session = createSession();
    const entity = mockRosterEntity("senna", ["driver_1"]);
    session.assignedEntities = { senna: entity };
    session.assignments.driver_1 = "senna";
    expect(getAssignedEntity(session, "driver_1")?.display_name).toBe("senna");
  });
});
