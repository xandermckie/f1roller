import { useCallback, useEffect, useRef, useState } from "react";

import type { RollSession, SlotId } from "@/types";
import {
  applyRosterResponse,
  buildTeamPayload,
  canAssignEntityToSlot,
  isSlotFilled,
  clearPerRoundState,
  clearSession,
  createSession,
  getPoolEntity,
  isAssignmentComplete,
  isRoundReady,
  isSetupComplete,
  loadSession,
  needsRosterRecovery,
  saveSession,
  syncCurrentSlotIndex,
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
  refetchCurrentRoster: () => Promise<void>;
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
      return syncCurrentSlotIndex(loaded);
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
      return applyRosterResponse(base, roster);
    },
    [],
  );

  const refetchCurrentRoster = useCallback(async (): Promise<void> => {
    let teamSlug: string | undefined;
    let decade: string | undefined;
    setSession((current) => {
      if (!current.rolledTeam || !current.rolledDecade) {
        return current;
      }
      teamSlug = current.rolledTeam.slug;
      decade = current.rolledDecade;
      return current;
    });
    if (!teamSlug || !decade) return;

    setLoading(true);
    setError(null);
    try {
      const roster = await fetchRoster(teamSlug, decade);
      setSession((current) => applyRosterResponse(current, roster));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roster load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const recoveryAttempted = useRef(false);
  useEffect(() => {
    if (recoveryAttempted.current || !needsRosterRecovery(session, loading)) return;
    recoveryAttempted.current = true;
    void refetchCurrentRoster();
  }, [session, loading, refetchCurrentRoster]);

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
      const team = await apiRollTeam(seed);
      const { decade } = await apiRollDecade(seed, team.slug);
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
        setSession((current) => applyRosterResponse(current, roster));
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
      const { decade } = await apiRollDecade(
        session.sessionSeed,
        session.rolledTeam.slug,
        salt,
      );
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
      let assignError: string | null = null;
      setSession((current) => {
        const entity = getPoolEntity(current, entityId);
        if (!entity) {
          assignError = "Entity not found in roster";
          return current;
        }
        if (!canAssignEntityToSlot(current, entity, slotId)) {
          assignError = isSlotFilled(current, slotId)
            ? "That slot is already filled"
            : `${entity.role_label ?? entity.display_name} cannot fill ${slotId.replaceAll("_", " ")}`;
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
    setSession((s) => {
      const assignments = { ...s.assignments };
      const entityId = assignments[slotId];
      delete assignments[slotId];
      const assignedEntities = { ...s.assignedEntities };
      if (entityId) {
        delete assignedEntities[entityId];
      }
      return syncCurrentSlotIndex({
        ...clearPerRoundState(s),
        assignments,
        assignedEntities,
      });
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
    refetchCurrentRoster,
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
