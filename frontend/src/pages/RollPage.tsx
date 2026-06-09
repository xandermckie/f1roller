import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { ProgressBar } from "@/components/ProgressBar";
import { RollCard } from "@/components/RollCard";
import { RosterEntityCard } from "@/components/RosterEntityCard";
import { useRollSession } from "@/hooks/useRollSession";
import { getHealth, simulate } from "@/lib/api";
import {
  countFilledSlots,
  getAssignedEntity,
  getAvailablePool,
  getCurrentSlot,
  hasActiveRound,
  isRoundRolled,
} from "@/lib/rollSession";
import {
  ROSTER_GROUP_LABELS,
  ROSTER_GROUP_ORDER,
  SLOT_LABELS,
  SLOT_ORDER,
  type RosterEntity,
  type SlotId,
} from "@/types";

export function RollPage(): React.ReactElement {
  const navigate = useNavigate();
  const {
    session,
    isAssignmentComplete,
    rollRound,
    rerollTeam,
    rerollDecade,
    assignToSlot,
    clearSlot,
    lockTeam,
    updateSession,
    loading,
    error,
  } = useRollSession();

  const [teamRevealed, setTeamRevealed] = useState(false);
  const [decadeRevealed, setDecadeRevealed] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const poolRef = useRef<HTMLElement>(null);

  const currentSlot = getCurrentSlot(session);
  const roundActive = hasActiveRound(session);
  const showRollButton = !roundActive && !isAssignmentComplete;
  const showPool = isRoundRolled(session) && !isAssignmentComplete;
  const poolLoading = showPool && loading && session.rosterPool.length === 0;

  const availablePool = useMemo(() => getAvailablePool(session), [session]);

  const groupedPool = useMemo(() => {
    const groups: Record<string, RosterEntity[]> = {};
    for (const entity of availablePool) {
      const key = entity.entity_type;
      groups[key] = groups[key] ?? [];
      groups[key].push(entity);
    }
    return groups;
  }, [availablePool]);

  useEffect(() => {
    getHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  useEffect(() => {
    if (session.rolledTeam && session.rolledDecade) {
      setTeamRevealed(true);
      setDecadeRevealed(true);
    } else {
      setTeamRevealed(false);
      setDecadeRevealed(false);
    }
  }, [session.rolledTeam, session.rolledDecade]);

  if (session.phase === "complete" && session.simResult) {
    return <Navigate to="/season" replace />;
  }

  const handleRollRound = async (): Promise<void> => {
    setIsRolling(true);
    setTeamRevealed(false);
    setDecadeRevealed(false);
    setSelectedEntityId(null);
    setLocalError(null);
    const ok = await rollRound();
    setIsRolling(false);
    if (ok) {
      requestAnimationFrame(() => {
        poolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const handleSlotClick = (slotId: SlotId): void => {
    const existing = session.assignments[slotId];
    if (existing) {
      clearSlot(slotId);
      setSelectedEntityId(null);
      return;
    }
    if (!selectedEntityId) return;
    const assignError = assignToSlot(selectedEntityId, slotId);
    if (assignError) {
      setLocalError(assignError);
      return;
    }
    setLocalError(null);
    setSelectedEntityId(null);
    if (slotId === currentSlot) {
      setTeamRevealed(false);
      setDecadeRevealed(false);
    }
  };

  const handleRerollTeam = async (): Promise<void> => {
    setSelectedEntityId(null);
    await rerollTeam();
  };

  const handleRerollDecade = async (): Promise<void> => {
    setSelectedEntityId(null);
    await rerollDecade();
  };

  const handleSimulate = async (): Promise<void> => {
    const result = lockTeam();
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    setSimulating(true);
    setLocalError(null);
    try {
      const simResult = await simulate(result.payload, session.sessionSeed);
      updateSession({ ...session, phase: "complete", teamPayload: result.payload, simResult });
      navigate("/season");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  const filledCount = countFilledSlots(session);

  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      <h1 style={{ marginTop: 0 }}>Roll Your Team</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        Each round rolls a new constructor and era. Pick from the full roster pool, then click a
        slot on the right to place them. Fill <strong>{SLOT_LABELS[currentSlot]}</strong> to
        advance. One team reroll and one decade reroll per game.
      </p>

      {backendOk === false && (
        <p role="alert" style={{ color: "var(--color-accent)", marginBottom: 16 }}>
          Cannot reach the API. Restart the backend: run task &quot;run: full stack (no debug)&quot;
          or kill port 8000 and start uvicorn again.
        </p>
      )}

      <ProgressBar current={filledCount} total={SLOT_ORDER.length} />

      <div className="roll-cards" style={{ marginTop: 24 }}>
        <RollCard
          entity={
            session.rolledTeam
              ? {
                  id: session.rolledTeam.slug,
                  slug: session.rolledTeam.slug,
                  display_name: session.rolledTeam.display_name,
                  entity_type: "constructor",
                }
              : null
          }
          revealed={teamRevealed}
          rolling={isRolling || (loading && !teamRevealed)}
          slotLabel="Your Team"
          onReroll={roundActive ? () => void handleRerollTeam() : undefined}
          rerollsLeft={session.rerollsRemaining.team}
          rerollDisabled={loading}
        />
        <RollCard
          entity={
            session.rolledDecade
              ? {
                  id: session.rolledDecade,
                  slug: session.rolledDecade,
                  display_name: session.rolledDecade,
                  entity_type: "decade",
                }
              : null
          }
          revealed={decadeRevealed}
          rolling={isRolling || (loading && !decadeRevealed)}
          slotLabel="Your Era"
          onReroll={roundActive ? () => void handleRerollDecade() : undefined}
          rerollsLeft={session.rerollsRemaining.decade}
          rerollDisabled={loading}
        />
      </div>

      {showRollButton && (
        <button
          type="button"
          className="btn"
          onClick={() => void handleRollRound()}
          disabled={loading || isRolling}
          style={{ marginTop: 16 }}
        >
          {loading || isRolling ? "Rolling…" : `Roll Team & Era for ${SLOT_LABELS[currentSlot]}`}
        </button>
      )}

      <div className="roll-layout">
        <section ref={poolRef}>
          {showPool && (
            <>
              <h2 style={{ fontSize: "1.125rem" }}>
                Roster Pool
                {session.rolledTeam && session.rolledDecade && (
                  <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
                    {" "}
                    — {session.rolledTeam.display_name} · {session.rolledDecade}
                    {availablePool.length > 0 ? ` · ${availablePool.length} available picks` : ""}
                  </span>
                )}
              </h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", margin: "0 0 16px" }}>
                {selectedEntityId
                  ? "Click a matching slot on the right to assign your selection."
                  : "Select a roster member below."}
              </p>
              {poolLoading ? (
                <p style={{ color: "var(--color-text-muted)" }}>Loading roster…</p>
              ) : availablePool.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)" }}>
                  {error
                    ? "Roster failed to load — see error below. Try rerolling or restart the backend."
                    : "No picks available for this team and era. Try rerolling team or decade."}
                </p>
              ) : (
                ROSTER_GROUP_ORDER.map((groupKey) => {
                  const entities = groupedPool[groupKey];
                  if (!entities?.length) return null;
                  return (
                    <div key={groupKey} style={{ marginBottom: 24 }}>
                      <h3
                        style={{
                          fontSize: "0.875rem",
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {ROSTER_GROUP_LABELS[groupKey] ?? groupKey}
                      </h3>
                      {entities.map((entity) => (
                        <RosterEntityCard
                          key={entity.id}
                          entity={entity}
                          selected={selectedEntityId === entity.id}
                          onSelect={() =>
                            setSelectedEntityId((current) =>
                              current === entity.id ? null : entity.id,
                            )
                          }
                        />
                      ))}
                    </div>
                  );
                })
              )}
              {session.poolWarnings?.map((warning) => (
                <p
                  key={warning}
                  style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", margin: "4px 0" }}
                >
                  {warning}
                </p>
              ))}
            </>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", marginTop: roundActive ? undefined : 0 }}>Team Slots</h2>
          {SLOT_ORDER.map((slotId, index) => {
            const assigned = getAssignedEntity(session, slotId);
            const isCurrent = index === session.currentSlotIndex && !assigned;
            const canReceiveSelection = Boolean(selectedEntityId && !assigned);
            return (
              <div
                key={slotId}
                className="card"
                style={{
                  marginBottom: 12,
                  border: isCurrent
                    ? "2px solid var(--color-accent)"
                    : canReceiveSelection
                      ? "1px dashed var(--color-accent)"
                      : undefined,
                  opacity: assigned ? 0.85 : isCurrent ? 1 : 0.6,
                  cursor: assigned || canReceiveSelection ? "pointer" : "default",
                }}
                onClick={() => handleSlotClick(slotId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSlotClick(slotId);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "0.75rem",
                    color: isCurrent ? "var(--color-accent)" : "var(--color-text-muted)",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {SLOT_LABELS[slotId]}
                  {isCurrent ? " — fill this slot to continue" : ""}
                </p>
                {assigned ? (
                  <>
                    <RosterEntityCard entity={assigned} assigned compact />
                    <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      Click to clear
                    </p>
                  </>
                ) : (
                  <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                    {canReceiveSelection ? "Click to assign here" : isCurrent ? "Roll and pick from pool" : "Waiting…"}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      </div>

      {(error || localError) && (
        <p role="alert" style={{ color: "var(--color-accent)", marginTop: 16 }}>
          {error ?? localError}
        </p>
      )}

      {isAssignmentComplete && (
        <button
          type="button"
          className="btn"
          onClick={() => void handleSimulate()}
          disabled={simulating || loading}
          style={{ marginTop: 16 }}
        >
          {simulating ? "Simulating Season…" : "Lock Team & Simulate"}
        </button>
      )}

      <style>{`
        .roll-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
          gap: 24px;
          align-items: start;
          margin-top: 24px;
        }
        .roll-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 768px) {
          .roll-layout {
            grid-template-columns: 1fr;
          }
          .roll-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
