import { useEffect, useMemo, useRef, useState } from "react";
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
  type RaceResult,
  type RosterEntity,
  type SlotId,
} from "@/types";

function parseGameMode(value: string | null): GameMode {
  return value === "2026" ? "2026" : "historical";
}

function DrawingAnimation(): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "48px 24px",
        borderRadius: "var(--radius-card)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 64,
              height: 88,
              borderRadius: 8,
              background: "var(--color-border)",
              animation: `cardFlip 1.2s ease-in-out ${i * 0.15}s infinite`,
              transformOrigin: "center",
            }}
          />
        ))}
      </div>
      <p style={{ margin: 0, color: "var(--color-text-muted)", fontFamily: "var(--font-display)" }}>
        Drawing your cards…
      </p>
      <style>{`
        @keyframes cardFlip {
          0%, 100% { transform: scaleY(1); opacity: 0.4; }
          50% { transform: scaleY(0.85); opacity: 1; background: var(--color-accent); }
        }
      `}</style>
    </div>
  );
}

function SlotCard({
  slotId,
  assigned,
  canReceiveDriver,
  onClick,
}: {
  slotId: SlotId;
  assigned: RosterEntity | undefined;
  canReceiveDriver: boolean;
  onClick: () => void;
}): React.ReactElement {
  const [imgFailed, setImgFailed] = useState(false);
  const accentColor = assigned?.accent_color ?? "var(--color-accent)";

  return (
    <div
      className="slot-card"
      style={{
        borderRadius: "var(--radius-card)",
        border: canReceiveDriver
          ? "2px dashed var(--color-accent)"
          : assigned
          ? `1px solid ${accentColor}44`
          : "1px solid var(--color-border)",
        background: "var(--color-surface)",
        boxShadow: "var(--color-card-shadow)",
        cursor: assigned || canReceiveDriver ? "pointer" : "default",
        overflow: "hidden",
        transition: "box-shadow 0.15s ease",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        marginBottom: 8,
      }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {assigned ? (
        <>
          {/* Portrait / avatar */}
          <div style={{ flexShrink: 0 }}>
            {assigned.portrait_path && !imgFailed ? (
              <img
                src={assigned.portrait_path}
                alt={assigned.display_name}
                onError={() => setImgFailed(true)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `2px solid ${accentColor}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: accentColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                }}
              >
                {assigned.display_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {SLOT_LABELS[slotId]}
            </p>
            <p style={{ margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {assigned.display_name}
            </p>
          </div>
          {assigned.computed_rating !== undefined && (
            <span
              style={{
                fontSize: "0.8125rem",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: accentColor,
                flexShrink: 0,
              }}
            >
              {toDisplayRating(assigned.computed_rating)}
            </span>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--color-border)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-muted)",
              fontSize: "1.1rem",
            }}
          >
            {canReceiveDriver ? "▸" : "·"}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 2px", fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {SLOT_LABELS[slotId]}
            </p>
            <p style={{ margin: 0, color: canReceiveDriver ? "var(--color-accent)" : "var(--color-text-muted)", fontSize: "0.875rem" }}>
              {canReceiveDriver ? "Choose position" : "Empty"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function RaceCard({ race, winsSoFar }: { race: RaceResult; winsSoFar: number }): React.ReactElement {
  const won = race.user_race_points >= 25;
  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${won ? "#22c55e" : "var(--color-accent)"}`,
        padding: "16px 20px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <p style={{ margin: "0 0 2px", color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
            Round {race.round}
          </p>
          <h3 style={{ margin: 0, fontSize: "1.125rem" }}>
            {race.circuit_short_name ?? race.meeting_name}
          </h3>
        </div>
        <div style={{ textAlign: "right" }}>
          <span
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: 20,
              background: won ? "#22c55e22" : "var(--color-border)",
              color: won ? "#22c55e" : "var(--color-text-muted)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
            }}
          >
            {won ? "WIN" : `+${race.user_race_points} pts`}
          </span>
        </div>
      </div>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        {race.positions.slice(0, 10).map((pos) => (
          <li
            key={`${pos.position}-${pos.team_name}`}
            style={{
              fontWeight: pos.is_user_driver ? 700 : 400,
              color: pos.is_user_driver ? "var(--color-text)" : "var(--color-text-muted)",
              padding: "2px 0",
              fontSize: "0.875rem",
            }}
          >
            {pos.driver_name} · {pos.team_name}
            {pos.is_user_driver && <span style={{ marginLeft: 6, color: "var(--color-accent)" }}>◀</span>}
          </li>
        ))}
      </ol>
      <p style={{ margin: "12px 0 0", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
        Wins so far: {winsSoFar} / {MAX_SEASON_ROUNDS}
      </p>
    </div>
  );
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
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoStopped, setAutoStopped] = useState(false);

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

  const autoRunRef = useRef(false);
  const handleAutoRun = async (): Promise<void> => {
    setAutoRunning(true);
    setAutoStopped(false);
    autoRunRef.current = true;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!autoRunRef.current) break;
      const result = await simulateNextRound();
      if (result.isComplete) {
        navigate("/results");
        break;
      }
      if (!autoRunRef.current) break;
      // Brief pause so the UI can update between rounds
      await new Promise<void>((resolve) => setTimeout(resolve, 600));
    }

    setAutoRunning(false);
  };

  const stopAutoRun = (): void => {
    autoRunRef.current = false;
    setAutoRunning(false);
    setAutoStopped(true);
  };

  const filledCount = countFilledSlots(session);
  const nextRound = session.simProgress.currentRound + 1;

  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 4 }}>Build Your Team</h1>
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

      {/* Season score banner */}
      {(racing || complete) && (
        <div
          style={{
            marginTop: 0,
            marginBottom: 24,
            borderRadius: "var(--radius-card)",
            overflow: "hidden",
            background: `linear-gradient(135deg, #1a1a1a 0%, #2a0a0a 100%)`,
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          <div>
            <p style={{ margin: "0 0 4px", color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Wins
            </p>
            <p style={{ margin: 0, fontSize: "2.5rem", fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff" }}>
              {winsSoFar}<span style={{ fontSize: "1.25rem", color: "rgba(255,255,255,0.5)" }}> / {MAX_SEASON_ROUNDS}</span>
            </p>
          </div>
          <div style={{ width: 1, height: 48, background: "rgba(255,255,255,0.15)" }} />
          <div>
            <p style={{ margin: "0 0 4px", color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Round
            </p>
            <p style={{ margin: 0, fontSize: "2.5rem", fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff" }}>
              {session.simProgress.currentRound}<span style={{ fontSize: "1.25rem", color: "rgba(255,255,255,0.5)" }}> / {MAX_SEASON_ROUNDS}</span>
            </p>
          </div>
        </div>
      )}

      <div className="play-layout" style={{ marginTop: 24 }}>
        {/* Left column: draw / race */}
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
                    Reroll ({session.drawRerollRemaining} left)
                  </button>
                )}
              </div>

              {/* Loading animation replaces "black screen" */}
              {(isDrawing || (loading && !isRoundRolled(session))) && (
                <DrawingAnimation />
              )}

              {showPacket && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h2 style={{ fontSize: "1.125rem", margin: 0 }}>Available choices</h2>
                    {session.rolledTeam && session.rolledDecade && (
                      <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                        {session.rolledTeam.display_name} · {session.rolledDecade}
                      </span>
                    )}
                  </div>
                  {pendingDriver && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "var(--color-accent)18",
                        border: "1px solid var(--color-accent)44",
                        marginBottom: 12,
                        color: "var(--color-accent)",
                        fontSize: "0.875rem",
                      }}
                    >
                      Place <strong>{pendingDriver.display_name}</strong> as Driver 1 or Driver 2 →
                    </div>
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
                <div style={{ marginTop: 16 }}>
                  <p style={{ color: "var(--color-text-muted)", margin: "0 0 12px", fontSize: "0.875rem" }}>
                    All 12 slots filled. Ready to race!
                  </p>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleStartSimulation}
                  >
                    Simulate season →
                  </button>
                </div>
              )}
            </>
          )}

          {/* Race result */}
          {(racing || complete) && latestRace && (
            <RaceCard race={latestRace} winsSoFar={winsSoFar} />
          )}

          {(racing || session.simProgress.phase === "ready") && !complete && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {autoRunning ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={stopAutoRun}
                  style={{ width: "100%" }}
                >
                  ⏸ Pause Auto-Simulate
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleAutoRun()}
                    disabled={loading}
                    style={{ width: "100%" }}
                  >
                    ▶ Auto-Simulate All {MAX_SEASON_ROUNDS - session.simProgress.currentRound} Remaining Rounds
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleSimulateRound()}
                    disabled={loading}
                    style={{ width: "100%" }}
                  >
                    {loading ? "Simulating…" : `Step: Simulate Round ${nextRound} →`}
                  </button>
                  {autoStopped && (
                    <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                      Paused after round {session.simProgress.currentRound}. Click auto-simulate to continue.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {complete && (
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <Link to="/results" className="btn" style={{ textDecoration: "none" }}>
                View Results
              </Link>
              <Link to="/season" className="btn btn-secondary" style={{ textDecoration: "none" }}>
                Season Overview
              </Link>
            </div>
          )}
        </section>

        {/* Right column: team slots */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: "1.125rem", margin: 0 }}>Your team</h2>
            {averageRating !== null && (
              <span
                style={{
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  color: "var(--color-accent)",
                }}
              >
                Avg. {averageRating}
              </span>
            )}
          </div>
          {SLOT_ORDER.map((slotId) => {
            const assigned = getAssignedEntity(session, slotId);
            const canReceiveDriver =
              Boolean(pendingDriver && canAssignEntityToSlot(session, pendingDriver, slotId));
            return (
              <SlotCard
                key={slotId}
                slotId={slotId}
                assigned={assigned}
                canReceiveDriver={canReceiveDriver}
                onClick={() => handleSlotClick(slotId)}
              />
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
