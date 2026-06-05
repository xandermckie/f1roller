import { describe, expect, it } from "vitest";

import {
  advancePhase,
  buildTeamPayload,
  createSession,
  getExcludedIds,
  getRoll,
  isRollComplete,
} from "@/lib/rollSession";
import type { RolledEntity, SlotId } from "@/types";

const mockEntity = (id: string): RolledEntity => ({
  id,
  slug: id,
  display_name: id,
  entity_type: "driver",
});

const ALL_SLOTS: SlotId[] = [
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
];

describe("rollSession", () => {
  it("creates session with rolling phase", () => {
    const s = createSession();
    expect(s.phase).toBe("rolling");
    expect(s.currentSlotIndex).toBe(0);
  });

  it("tracks excluded ids", () => {
    const s = createSession();
    s.rolls.driver_1 = mockEntity("a");
    expect(getExcludedIds(s)).toContain("a");
  });

  it("advances slot index", () => {
    const s = createSession();
    const next = advancePhase(s);
    expect(next.currentSlotIndex).toBe(1);
  });

  it("detects incomplete rolls", () => {
    const s = createSession();
    expect(isRollComplete(s)).toBe(false);
  });

  it("does not treat Object.prototype.constructor as a rolled constructor", () => {
    const s = createSession();
    for (const slot of ALL_SLOTS) {
      if (slot === "constructor") continue;
      s.rolls[slot] = mockEntity(slot);
    }

    expect(getRoll(s, "constructor")).toBeUndefined();
    expect(isRollComplete(s)).toBe(false);
    expect(buildTeamPayload(s)).toBeNull();
  });

  it("reads constructor roll when own property is set", () => {
    const s = createSession();
    for (const slot of ALL_SLOTS) {
      s.rolls[slot] = mockEntity(slot);
    }

    expect(getRoll(s, "constructor")?.id).toBe("constructor");
    expect(isRollComplete(s)).toBe(true);
  });

  it("builds team payload when complete", () => {
    const s = createSession();
    for (const slot of ALL_SLOTS) {
      s.rolls[slot] = mockEntity(slot);
    }
    const payload = buildTeamPayload(s);
    expect(payload).not.toBeNull();
    expect(payload?.driver_1_id).toBe("driver_1");
    expect(payload?.constructor_id).toBe("constructor");
  });
});
