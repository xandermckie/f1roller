import { useCallback, useEffect, useState } from "react";

import type { RollSession, RolledEntity, SlotId } from "@/types";
import { SLOT_ORDER } from "@/types";
import {
  buildTeamPayload,
  clearSession,
  createSession,
  currentSlot,
  getExcludedIds,
  isRollComplete,
  loadSession,
  saveSession,
} from "@/lib/rollSession";
import { roll as apiRoll } from "@/lib/api";

export function useRollSession(): {
  session: RollSession;
  currentSlotId: SlotId | null;
  isComplete: boolean;
  rollCurrentSlot: () => Promise<RolledEntity | null>;
  advanceSlot: () => void;
  swapDrivers: () => void;
  lockTeam: () => TeamPayloadResult;
  resetSession: () => void;
  updateSession: (s: RollSession) => void;
  rolling: boolean;
  error: string | null;
} {
  const [session, setSession] = useState<RollSession>(() => loadSession() ?? createSession());
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const updateSession = useCallback((s: RollSession) => setSession(s), []);

  const rollCurrentSlot = useCallback(async (): Promise<RolledEntity | null> => {
    const slot = currentSlot(session);
    if (!slot) return null;
    setRolling(true);
    setError(null);
    try {
      const entity = await apiRoll(slot, getExcludedIds(session), session.sessionSeed);
      const updated: RollSession = {
        ...session,
        rolls: { ...session.rolls, [slot]: entity },
      };
      setSession(updated);
      return entity;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
      return null;
    } finally {
      setRolling(false);
    }
  }, [session]);

  const advanceSlot = useCallback(() => {
    setSession((s) => {
      const nextIndex = Math.min(s.currentSlotIndex + 1, SLOT_ORDER.length - 1);
      const updated: RollSession = {
        ...s,
        currentSlotIndex: nextIndex,
        phase: isRollComplete({ ...s, currentSlotIndex: nextIndex }) ? "assigning" : s.phase,
      };
      if (isRollComplete(updated)) {
        updated.phase = "assigning";
      }
      return updated;
    });
  }, []);

  const swapDrivers = useCallback(() => {
    setSession((s) => ({ ...s, driverOrderSwapped: !s.driverOrderSwapped }));
  }, []);

  const lockTeam = useCallback((): TeamPayloadResult => {
    const payload = buildTeamPayload(session);
    if (!payload) return { ok: false, error: "Incomplete team" };
    const updated = { ...session, phase: "simulating" as const, teamPayload: payload };
    setSession(updated);
    return { ok: true, payload };
  }, [session]);

  const resetSession = useCallback(() => {
    clearSession();
    setSession(createSession());
  }, []);

  return {
    session,
    currentSlotId: currentSlot(session),
    isComplete: isRollComplete(session),
    rollCurrentSlot,
    advanceSlot,
    swapDrivers,
    lockTeam,
    resetSession,
    updateSession,
    rolling,
    error,
  };
}

export type TeamPayloadResult =
  | { ok: true; payload: NonNullable<ReturnType<typeof buildTeamPayload>> }
  | { ok: false; error: string };
