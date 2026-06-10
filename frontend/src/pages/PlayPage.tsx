import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ProgressBar } from "@/components/ProgressBar";
import { RosterEntityCard } from "@/components/RosterEntityCard";
import { useRollSession } from "@/hooks/useRollSession";
import { getHealth } from "@/lib/api";
import {
  canAssignEntityToSlot,
  countFilledSlots,
  getAssignedEntity,
  getAvailablePool,
  getPoolEntity,
  hasActiveRound,
  isEntityAssignable,
  isRoundRolled,
  isSlotFilled,
  MAX_SEASON_ROUNDS,
} from "@/lib/rollSession";
import { teamAverageRating, toDisplayRating } from "@/lib/ratingDisplay";
import {
  SLOT_LABELS,
  SLOT_ORDER,
  type GameMode,
  type RosterEntity,
  type SlotId,
} from "@/types";

function parseGameMode(value: string | null): GameMode {
  return value === "2026" ? "2026" : "historical";
}

export function PlayPage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameMode = parseGameMode(searchParams.get("mode"));

  const {
    session,
    isAssignmentComplete,
    drawRound,
    rerollDraw,
    assignToSlot,
    clearSlot,
    startSimulation,
    simulateNextRound,
    resetSession,
    loading,
    error,
  } = useRollSession(gameMode);

  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [pendingDriverEntityId, setPendingDriverEntityId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  const building = session.simProgress.phase === "building";
  const racing = session.simProgress.phase === "racing" || session.simProgress.phase === "ready";
  const complete = session.simProgress.phase === "complete";

  const roundActive = hasActiveRound(session) || (loading && isRoundRolled(session));
  const showDrawButton = building && !roundActive && !isAssignmentComplete;
  const showPacket = isRoundRolled(session) && !isAssignmentComplete;

  const availablePool = useMemo(() => getAvailablePool(session), [session]);
  const pendingDriver = useMemo(
    () => (pendingDriverEntityId ? getPoolEntity(session, pendingDriverEntityId) : undefined),
    [session, pendingDriverEntityId],
  );

  const assignedEntities = useMemo(
    () =>
      SLOT_ORDER.map((slotId) => getAssignedEntity(session, slotId)).filter(
        (entity): entity is RosterEntity => Boolean(entity),
      ),
    [session],
  );
  const averageRating = teamAverageRating(assignedEntities);

  const winsSoFar = useMemo(
    () => session.simProgress.revealedRaces.filter((race) => race.user_race_points >= 25).length,
    [session.simProgress.revealedRaces],
  );

  const latestRace = session.simProgress.revealedRaces.at(-1);

  useEffect(() => {
    getHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  const handleDraw = async (): Promise<void> => {
    setIsDrawing(true);
    setSelectedEntityId(null);
    setPendingDriverEntityId(null);
    setLocalError(null);
    try {
      await drawRound();
    } finally {
      setIsDrawing(false);
    }
  };

  const handleEntityClick = (entity: RosterEntity): void => {
    if (!isEntityAssignable(session, entity)) {
      return;
    }

    const driverSlots = (["driver_1", "driver_2"] as const).filter(
      (slot) => !isSlotFilled(session, slot),
    );
    const isDriverCard = entity.assignable_slots.some((slot) =>
      (["driver_1", "driver_2", "reserve_driver"] as SlotId[]).includes(slot),
    );

    if (
      isDriverCard &&
      driverSlots.length === 2 &&
      entity.assignable_slots.includes("driver_1") &&
      entity.assignable_slots.includes("driver_2")
    ) {
      setPendingDriverEntityId(entity.id);
      setSelectedEntityId(null);
      return;
    }

    const targetSlot = entity.assignable_slots.find((slot) => !isSlotFilled(session, slot));
    if (!targetSlot) {
      return;
    }
    assignEntity(entity.id, targetSlot);
  };

  const assignEntity = (entityId: string, slotId: SlotId): void => {
    const assignError = assignToSlot(entityId, slotId);
    if (assignError) {
      setLocalError(assignError);
      return;
    }
    setLocalError(null);
    setSelectedEntityId(null);
    setPendingDriverEntityId(null);
    if (!isAssignmentComplete) {
      void handleDraw();
    }
  };

  const handleSlotClick = (slotId: SlotId): void => {
    if (pendingDriver && canAssignEntityToSlot(session, pendingDriver, slotId)) {
      assignEntity(pendingDriver.id, slotId);
      return;
    }
    if (isSlotFilled(session, slotId)) {
      clearSlot(slotId);
      setSelectedEntityId(null);
      setPendingDriverEntityId(null);
    }
  };

  const handleStartSimulation = (): void => {
    const result = startSimulation();
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    setLocalError(null);
  };

  const handleSimulateRound = async (): Promise<void> => {
    const result = await simulateNextRound();
    if (result.isComplete) {
      navigate("/results");
    }
  };

  const filledCount = countFilledSlots(session);
  const nextRound = session.simProgress.currentRound + 1;

  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={{ marginTop: 0 }}>Build Your Team</h1>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            {gameMode === "2026" ? "2026 season" : "Historical"} · Draw packets · {MAX_SEASON_ROUNDS} races
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            resetSession();
            setSelectedEntityId(null);
            setPendingDriverEntityId(null);
            setLocalError(null);
          }}
          style={{ flexShrink: 0, marginTop: 4 }}
        >
          Start New Team
        </button>
      </div>

      {backendOk === false && (
        <p role="alert" style={{ color: "var(--color-accent)", marginBottom: 16 }}>
          Cannot reach the API. Restart the backend on port 8000.
        </p>
      )}

      {building && <ProgressBar current={filledCount} total={SLOT_ORDER.length} />}

      {(racing || complete) && (
        <div className="card" style={{ marginTop: 24, marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 8px" }}>Result</h2>
          <p style={{ margin: 0, fontSize: "2rem", fontFamily: "var(--font-display)" }}>
            {winsSoFar} / {MAX_SEASON_ROUNDS}
          </p>
        </div>
      )}

      <div className="play-layout" style={{ marginTop: 24 }}>
        <section>
          {building && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                {showDrawButton && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleDraw()}
                    disabled={loading || isDrawing}
                  >
                    {loading || isDrawing ? "Drawing…" : "Draw a team"}
                  </button>
                )}
                {roundActive && session.drawRerollRemaining > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void rerollDraw()}
                    disabled={loading}
                  >
                    Reroll
                  </button>
                )}
              </div>

              {showPacket && (
                <>
                  <h2 style={{ fontSize: "1.125rem" }}>Available choices</h2>
                  {session.rolledTeam && session.rolledDecade && (
                    <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
                      {session.rolledTeam.display_name} · {session.rolledDecade}
                    </p>
                  )}
                  {pendingDriver && (
                    <p style={{ color: "var(--color-accent)" }}>
                      Place {pendingDriver.display_name} as Driver 1 or Driver 2
                    </p>
                  )}
                  {loading && availablePool.length === 0 ? (
                    <p style={{ color: "var(--color-text-muted)" }}>Drawing in progress…</p>
                  ) : (
                    availablePool.map((entity) => {
                      const assignable = isEntityAssignable(session, entity);
                      return (
                        <div key={entity.id} style={{ marginBottom: 12, opacity: assignable ? 1 : 0.45 }}>
                          <RosterEntityCard
                            entity={entity}
                            selected={selectedEntityId === entity.id}
                            onSelect={() => handleEntityClick(entity)}
                            disabled={!assignable}
                            displayRating={toDisplayRating(entity.computed_rating)}
                          />
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {isAssignmentComplete && session.simProgress.phase === "building" && (
                <button
                  type="button"
                  className="btn"
                  onClick={handleStartSimulation}
                  style={{ marginTop: 16 }}
                >
                  Simulate season
                </button>
              )}
            </>
          )}

          {(racing || complete) && latestRace && (
            <div className="card">
              <p style={{ margin: "0 0 4px", color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                Grand Prix
              </p>
              <h3 style={{ margin: "0 0 12px" }}>
                {latestRace.circuit_short_name ?? latestRace.meeting_name}
              </h3>
              <p style={{ margin: "0 0 8px", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                Top 10
              </p>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {latestRace.positions.slice(0, 10).map((pos) => (
                  <li
                    key={`${pos.position}-${pos.team_name}`}
                    style={{ fontWeight: pos.is_user_team ? 700 : 400, padding: "2px 0" }}
                  >
                    {pos.driver_name} · {pos.team_name} (+{pos.points})
                  </li>
                ))}
              </ol>
            </div>
          )}

          {(racing || session.simProgress.phase === "ready") && !complete && (
            <button
              type="button"
              className="btn"
              onClick={() => void handleSimulateRound()}
              disabled={loading}
              style={{ marginTop: 16 }}
            >
              {loading ? "Simulating…" : `Simulate round ${nextRound}`}
            </button>
          )}

          {complete && (
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <Link to="/results" className="btn" style={{ textDecoration: "none" }}>
                View results
              </Link>
              <Link to="/season" className="btn btn-secondary" style={{ textDecoration: "none" }}>
                Season overview
              </Link>
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem" }}>Your team</h2>
          {averageRating !== null && (
            <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
              Avg. {averageRating}
            </p>
          )}
          {SLOT_ORDER.map((slotId) => {
            const assigned = getAssignedEntity(session, slotId);
            const canReceiveDriver =
              pendingDriver && canAssignEntityToSlot(session, pendingDriver, slotId);
            return (
              <div
                key={slotId}
                className="card"
                style={{
                  marginBottom: 12,
                  border: canReceiveDriver ? "2px dashed var(--color-accent)" : undefined,
                  cursor: assigned || canReceiveDriver ? "pointer" : "default",
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
                <p style={{ margin: "0 0 8px", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                  {SLOT_LABELS[slotId]}
                </p>
                {assigned ? (
                  <>
                    <RosterEntityCard entity={assigned} assigned compact />
                    {session.rolledTeam && (
                      <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                        {toDisplayRating(assigned.computed_rating)} · from your picks
                      </p>
                    )}
                  </>
                ) : canReceiveDriver ? (
                  <p style={{ margin: 0, color: "var(--color-accent)" }}>Choose</p>
                ) : (
                  <p style={{ margin: 0, color: "var(--color-text-muted)" }}>—</p>
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

      <style>{`
        .play-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .play-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
