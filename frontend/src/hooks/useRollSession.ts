import { useCallback, useEffect, useRef, useState } from "react";

import type { GameMode, RollSession, SlotId } from "@/types";
import {
  applyDrawResponse,
  buildTeamPayload,
  canAssignEntityToSlot,
  clearPerRoundState,
  clearSession,
  createSession,
  getEmptySlots,
  getPoolEntity,
  isAssignmentComplete,
  isRoundReady,
  isSetupComplete,
  loadSession,
  mergeSimResult,
  needsRosterRecovery,
  saveSession,
  syncCurrentSlotIndex,
} from "@/lib/rollSession";
import { drawTeam, simulateRound } from "@/lib/api";

const MIN_ROLL_ANIMATION_MS = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useRollSession(initialGameMode?: GameMode): {
  session: RollSession;
  isSetupComplete: boolean;
  isAssignmentComplete: boolean;
  isRoundReady: boolean;
  drawRound: () => Promise<boolean>;
  rerollDraw: () => Promise<void>;
  assignToSlot: (entityId: string, slotId: SlotId) => string | null;
  clearSlot: (slotId: SlotId) => void;
  lockTeam: () => TeamPayloadResult;
  startSimulation: () => TeamPayloadResult;
  simulateNextRound: () => Promise<{ ok: boolean; isComplete: boolean }>;
  resetSession: () => void;
  updateSession: (s: RollSession) => void;
  loading: boolean;
  error: string | null;
} {
  const [session, setSession] = useState<RollSession>(() => {
    const loaded = loadSession();
    if (loaded) {
      return syncCurrentSlotIndex(loaded);
    }
    return createSession(initialGameMode ?? "historical");
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const updateSession = useCallback((s: RollSession) => setSession(s), []);

  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const drawRound = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const startedAt = Date.now();

    const current = sessionRef.current;
    if (isAssignmentComplete(current)) {
      setLoading(false);
      return false;
    }

    try {
      const emptySlots = getEmptySlots(current);
      const draw = await drawTeam(
        current.sessionSeed,
        current.gameMode,
        emptySlots,
        emptySlots.length === 12 ? 0 : 12 - emptySlots.length,
      );
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_ROLL_ANIMATION_MS) {
        await delay(MIN_ROLL_ANIMATION_MS - elapsed);
      }

      setSession((value) => applyDrawResponse(value, draw));
      return draw.draw_packet.length > 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const rerollDraw = useCallback(async (): Promise<void> => {
    const current = sessionRef.current;
    if (current.drawRerollRemaining <= 0 || !current.rolledTeam) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const emptySlots = getEmptySlots(current);
      const draw = await drawTeam(
        current.sessionSeed,
        current.gameMode,
        emptySlots,
        12 - emptySlots.length,
        {
          excludedTeamSlugs: [current.rolledTeam.slug],
          rerollSalt: crypto.randomUUID(),
        },
      );
      setSession((value) =>
        applyDrawResponse(
          {
            ...value,
            drawRerollRemaining: value.drawRerollRemaining - 1,
          },
          draw,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reroll failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const assignToSlot = useCallback(
    (entityId: string, slotId: SlotId): string | null => {
      let assignError: string | null = null;
      setSession((current) => {
        const entity = getPoolEntity(current, entityId);
        if (!entity) {
          assignError = "Entity not found in draw packet";
          return current;
        }
        if (!canAssignEntityToSlot(current, entity, slotId)) {
          assignError = "Cannot assign to that slot";
          return current;
        }
        const assignedIds = new Set(
          Object.entries(current.assignments)
            .filter(([, id]) => id)
            .map(([, id]) => id),
        );
        if (assignedIds.has(entityId)) {
          assignError = "This person is already on your team";
          return current;
        }

        const withAssignment: RollSession = {
          ...current,
          assignments: { ...current.assignments, [slotId]: entityId },
          assignedEntities: {
            ...current.assignedEntities,
            [entityId]: entity,
          },
          phase: "assigning",
        };

        return syncCurrentSlotIndex(clearPerRoundState(withAssignment));
      });
      return assignError;
    },
    [],
  );

  const clearSlot = useCallback((slotId: SlotId): void => {
    setSession((current) => {
      const assignments = { ...current.assignments };
      const entityId = assignments[slotId];
      delete assignments[slotId];
      const assignedEntities = { ...current.assignedEntities };
      if (entityId) {
        delete assignedEntities[entityId];
      }
      return syncCurrentSlotIndex({
        ...clearPerRoundState(current),
        assignments,
        assignedEntities,
      });
    });
  }, []);

  const lockTeam = useCallback((): TeamPayloadResult => {
    const payload = buildTeamPayload(session);
    if (!payload) return { ok: false, error: "Fill all 12 slots before simulating" };
    const updated: RollSession = {
      ...session,
      phase: "simulating",
      teamPayload: payload,
      simProgress: {
        ...session.simProgress,
        phase: "ready",
      },
    };
    setSession(updated);
    return { ok: true, payload };
  }, [session]);

  const startSimulation = lockTeam;

  const simulateNextRound = useCallback(async (): Promise<{ ok: boolean; isComplete: boolean }> => {
    const payload = buildTeamPayload(session);
    if (!payload) {
      setError("Fill all 12 slots before simulating");
      return { ok: false, isComplete: false };
    }

    const nextRound = session.simProgress.currentRound + 1;
    if (nextRound > session.simProgress.maxRounds) {
      return { ok: false, isComplete: false };
    }

    setLoading(true);
    setError(null);
    try {
      const result = await simulateRound(
        payload,
        session.sessionSeed,
        nextRound,
        session.gameMode,
      );
      setSession((current) => {
        const revealedRaces = [...current.simProgress.revealedRaces, result.race];
        const next: RollSession = {
          ...current,
          teamPayload: payload,
          phase: result.is_complete ? "complete" : "simulating",
          simProgress: {
            phase: result.is_complete ? "complete" : "racing",
            currentRound: nextRound,
            revealedRaces,
            maxRounds: result.max_wins,
          },
        };
        if (result.season_result) {
          return mergeSimResult(next, result.season_result);
        }
        return next;
      });
      return { ok: true, isComplete: result.is_complete };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      return { ok: false, isComplete: false };
    } finally {
      setLoading(false);
    }
  }, [session]);

  const resetSession = useCallback(() => {
    clearSession();
    setSession(createSession(session.gameMode));
  }, [session.gameMode]);

  const recoveryAttempted = useRef(false);
  useEffect(() => {
    if (recoveryAttempted.current || !needsRosterRecovery(session, loading)) return;
    recoveryAttempted.current = true;
    void drawRound();
  }, [session, loading, drawRound]);

  return {
    session,
    isSetupComplete: isSetupComplete(session),
    isAssignmentComplete: isAssignmentComplete(session),
    isRoundReady: isRoundReady(session),
    drawRound,
    rerollDraw,
    assignToSlot,
    clearSlot,
    lockTeam,
    startSimulation,
    simulateNextRound,
    resetSession,
    updateSession,
    loading,
    error,
  };
}

export type TeamPayloadResult =
  | { ok: true; payload: NonNullable<ReturnType<typeof buildTeamPayload>> }
  | { ok: false; error: string };
