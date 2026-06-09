import { useCallback, useEffect, useState } from "react";

import type { RollSession, SlotId } from "@/types";
import { SLOT_ORDER } from "@/types";
import {
  buildTeamPayload,
  canAssign,
  clearPerRoundState,
  clearSession,
  createSession,
  getCurrentSlot,
  getNextEmptySlotIndex,
  getPoolEntity,
  isAssignmentComplete,
  isRoundReady,
  isSetupComplete,
  loadSession,
  saveSession,
} from "@/lib/rollSession";
import {
  fetchRoster,
  rollDecade as apiRollDecade,
  rollTeam as apiRollTeam,
} from "@/lib/api";

const MIN_ROLL_ANIMATION_MS = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useRollSession(): {
  session: RollSession;
  isSetupComplete: boolean;
  isAssignmentComplete: boolean;
  isRoundReady: boolean;
  rollRound: () => Promise<boolean>;
  rerollTeam: () => Promise<void>;
  rerollDecade: () => Promise<void>;
  assignToSlot: (entityId: string, slotId: SlotId) => string | null;
  clearSlot: (slotId: SlotId) => void;
  lockTeam: () => TeamPayloadResult;
  resetSession: () => void;
  updateSession: (s: RollSession) => void;
  loading: boolean;
  error: string | null;
} {
  const [session, setSession] = useState<RollSession>(() => {
    const loaded = loadSession();
    if (loaded) {
      const nextIndex = getNextEmptySlotIndex(loaded) ?? loaded.currentSlotIndex;
      return { ...clearPerRoundState(loaded), currentSlotIndex: nextIndex };
    }
    return createSession();
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const updateSession = useCallback((s: RollSession) => setSession(s), []);

  const loadRosterForRound = useCallback(
    async (base: RollSession): Promise<RollSession> => {
      if (!base.rolledTeam || !base.rolledDecade) {
        return { ...base, rosterPool: [] };
      }
      const roster = await fetchRoster(base.rolledTeam.slug, base.rolledDecade);
      return {
        ...base,
        rosterPool: roster.entities,
        poolWarnings: roster.pool_warnings,
      };
    },
    [],
  );

  const rollRound = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const startedAt = Date.now();

    let seed = "";
    let skip = false;
    setSession((current) => {
      if (isAssignmentComplete(current)) {
        skip = true;
        return current;
      }
      seed = current.sessionSeed;
      return current;
    });
    if (skip) {
      setLoading(false);
      return false;
    }

    try {
      const [team, { decade }] = await Promise.all([
        apiRollTeam(seed),
        apiRollDecade(seed),
      ]);
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_ROLL_ANIMATION_MS) {
        await delay(MIN_ROLL_ANIMATION_MS - elapsed);
      }

      setSession((current) => ({
        ...current,
        rolledTeam: { slug: team.slug, display_name: team.display_name },
        rolledDecade: decade,
        rosterPool: [],
        poolWarnings: undefined,
      }));

      try {
        const roster = await fetchRoster(team.slug, decade);
        setSession((current) => ({
          ...current,
          rosterPool: roster.entities,
          poolWarnings: roster.pool_warnings,
        }));
        return roster.entities.length > 0;
      } catch (rosterErr) {
        setError(rosterErr instanceof Error ? rosterErr.message : "Roster load failed");
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const rerollTeam = useCallback(async (): Promise<void> => {
    if (session.rerollsRemaining.team <= 0 || !session.rolledTeam) return;
    setLoading(true);
    setError(null);
    try {
      const salt = crypto.randomUUID();
      const team = await apiRollTeam(session.sessionSeed, {
        excludedTeamSlugs: [session.rolledTeam.slug],
        rerollSalt: salt,
      });
      const next: RollSession = {
        ...session,
        rolledTeam: { slug: team.slug, display_name: team.display_name },
        rerollsRemaining: {
          ...session.rerollsRemaining,
          team: session.rerollsRemaining.team - 1,
        },
      };
      const withRoster = session.rolledDecade
        ? await loadRosterForRound(next)
        : next;
      setSession(withRoster);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Team reroll failed");
    } finally {
      setLoading(false);
    }
  }, [session, loadRosterForRound]);

  const rerollDecade = useCallback(async (): Promise<void> => {
    if (session.rerollsRemaining.decade <= 0 || !session.rolledDecade) return;
    setLoading(true);
    setError(null);
    try {
      const salt = crypto.randomUUID();
      const { decade } = await apiRollDecade(session.sessionSeed, salt);
      const next: RollSession = {
        ...session,
        rolledDecade: decade,
        rerollsRemaining: {
          ...session.rerollsRemaining,
          decade: session.rerollsRemaining.decade - 1,
        },
      };
      const withRoster = session.rolledTeam
        ? await loadRosterForRound(next)
        : next;
      setSession(withRoster);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decade reroll failed");
    } finally {
      setLoading(false);
    }
  }, [session, loadRosterForRound]);

  const assignToSlot = useCallback(
    (entityId: string, slotId: SlotId): string | null => {
      const entity = getPoolEntity(session, entityId);
      if (!entity) return "Entity not found in roster";
      if (!canAssign(entity, slotId)) {
        return `${entity.role_label ?? entity.display_name} cannot fill ${slotId.replaceAll("_", " ")}`;
      }
      const assignedIds = new Set(
        Object.entries(session.assignments)
          .filter(([slot, id]) => slot !== slotId && id)
          .map(([, id]) => id),
      );
      if (assignedIds.has(entityId)) {
        return "This person is already on your team";
      }

      const currentSlot = getCurrentSlot(session);
      const nextIndex = session.currentSlotIndex + 1;
      const filledCurrentSlot = slotId === currentSlot;
      const withAssignment: RollSession = {
        ...session,
        assignments: { ...session.assignments, [slotId]: entityId },
        assignedEntities: {
          ...session.assignedEntities,
          [entityId]: entity,
        },
        phase: "assigning",
      };

      if (filledCurrentSlot) {
        const cleared = clearPerRoundState(withAssignment);
        if (nextIndex >= SLOT_ORDER.length) {
          setSession({ ...cleared, currentSlotIndex: SLOT_ORDER.length - 1 });
        } else {
          setSession({ ...cleared, currentSlotIndex: nextIndex });
        }
      } else {
        setSession(withAssignment);
      }
      return null;
    },
    [session],
  );

  const clearSlot = useCallback((slotId: SlotId): void => {
    setSession((s) => {
      const assignments = { ...s.assignments };
      const entityId = assignments[slotId];
      delete assignments[slotId];
      const assignedEntities = { ...s.assignedEntities };
      if (entityId) {
        delete assignedEntities[entityId];
      }
      const slotIndex = SLOT_ORDER.indexOf(slotId);
      return {
        ...clearPerRoundState(s),
        assignments,
        assignedEntities,
        currentSlotIndex: slotIndex,
      };
    });
  }, []);

  const lockTeam = useCallback((): TeamPayloadResult => {
    const payload = buildTeamPayload(session);
    if (!payload) return { ok: false, error: "Fill all 12 slots before simulating" };
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
    isSetupComplete: isSetupComplete(session),
    isAssignmentComplete: isAssignmentComplete(session),
    isRoundReady: isRoundReady(session),
    rollRound,
    rerollTeam,
    rerollDecade,
    assignToSlot,
    clearSlot,
    lockTeam,
    resetSession,
    updateSession,
    loading,
    error,
  };
}

export type TeamPayloadResult =
  | { ok: true; payload: NonNullable<ReturnType<typeof buildTeamPayload>> }
  | { ok: false; error: string };
