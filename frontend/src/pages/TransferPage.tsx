import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getTransferCandidates } from "@/lib/api";
import { advanceToNextSeason, applyTransfer, getAssignedEntity, isAssignmentComplete } from "@/lib/rollSession";
import { toDisplayRating } from "@/lib/ratingDisplay";
import { useRollSession } from "@/hooks/useRollSession";
import {
  SLOT_LABELS,
  SLOT_ORDER,
  TRANSFERS_PER_OFFSEASON,
  TRANSFER_RATING_WINDOW,
  type RosterEntity,
  type SlotId,
} from "@/types";

const TRADEABLE_SLOTS: SlotId[] = [
  "driver_1",
  "driver_2",
  "reserve_driver",
  "constructor",
  "engine",
  "team_principal",
  "technical_director",
  "lead_engineer",
];

function RatingBar({ value }: { value: number }): React.ReactElement {
  const color =
    value >= 75 ? "#22c55e" : value >= 50 ? "#f59e0b" : "var(--color-accent)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--color-border)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "0.875rem",
          color,
          width: 28,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EntityCard({
  entity,
  onSelect,
  selected,
  ratingDelta,
  disabled,
}: {
  entity: RosterEntity;
  onSelect: () => void;
  selected: boolean;
  ratingDelta: number;
  disabled: boolean;
}): React.ReactElement {
  const displayRating = toDisplayRating(entity.computed_rating);
  const accentColor = entity.accent_color ?? "var(--color-accent)";
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className="card"
      style={{
        padding: "12px 14px",
        marginBottom: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        border: selected
          ? `2px solid ${accentColor}`
          : "1px solid var(--color-border)",
        boxShadow: selected ? `0 0 0 3px ${accentColor}22` : undefined,
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onClick={disabled ? undefined : onSelect}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Avatar */}
        {entity.portrait_path && !imgFailed ? (
          <img
            src={entity.portrait_path}
            alt={entity.display_name}
            onError={() => setImgFailed(true)}
            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accentColor}`, flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: accentColor,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            {entity.display_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entity.display_name}
          </strong>
          {entity.nationality && (
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {entity.nationality}{entity.peak_year ? ` · Peak ${entity.peak_year}` : ""}
            </span>
          )}
          <RatingBar value={displayRating} />
        </div>
        {/* Delta badge */}
        {ratingDelta !== 0 && (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 20,
              fontSize: "0.75rem",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              background: ratingDelta > 0 ? "#22c55e22" : "#ef444422",
              color: ratingDelta > 0 ? "#22c55e" : "#ef4444",
              flexShrink: 0,
            }}
          >
            {ratingDelta > 0 ? "+" : ""}{ratingDelta}
          </span>
        )}
      </div>
    </div>
  );
}

export function TransferPage(): React.ReactElement {
  const navigate = useNavigate();
  const { session, updateSession } = useRollSession();

  const [activeSlot, setActiveSlot] = useState<SlotId | null>(null);
  const [candidates, setCandidates] = useState<RosterEntity[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [pendingEntity, setPendingEntity] = useState<RosterEntity | null>(null);
  const [confirming, setConfirming] = useState(false);

  const career = session.career;
  const seasonNumber = (career?.seasons ?? 0) + 1;
  const tradesUsed = session.tradesUsed ?? 0;
  const tradesLeft = TRANSFERS_PER_OFFSEASON - tradesUsed;

  // Redirect if team not built
  if (!isAssignmentComplete(session)) {
    return (
      <div className="container">
        <p>Build your team first.</p>
        <Link to="/play">Back to team builder</Link>
      </div>
    );
  }

  // Collect all current entity IDs (to exclude from candidates)
  const currentEntityIds = Object.values(session.assignments).filter(Boolean) as string[];

  const loadCandidates = useCallback(async (slotId: SlotId): Promise<void> => {
    setActiveSlot(slotId);
    setPendingEntity(null);
    setLoadingCandidates(true);
    const currentEntity = getAssignedEntity(session, slotId);
    const currentRating = currentEntity?.computed_rating ?? 0.5;
    try {
      const result = await getTransferCandidates(slotId, currentRating, currentEntityIds);
      setCandidates(result);
    } catch {
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, [session, currentEntityIds]);

  const confirmTrade = (): void => {
    if (!activeSlot || !pendingEntity) return;
    setConfirming(true);
    const updated = applyTransfer(session, activeSlot, pendingEntity);
    updateSession(updated);
    setActiveSlot(null);
    setPendingEntity(null);
    setCandidates([]);
    setConfirming(false);
  };

  const cancelTrade = (): void => {
    setActiveSlot(null);
    setPendingEntity(null);
    setCandidates([]);
  };

  const handleContinueSeason = (): void => {
    const nextSession = advanceToNextSeason(session);
    updateSession(nextSession);
    navigate("/play");
  };

  const currentEntity = activeSlot ? getAssignedEntity(session, activeSlot) : null;
  const currentDisplayRating = toDisplayRating(currentEntity?.computed_rating);

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          marginBottom: 28,
          background: `linear-gradient(135deg, #0d1117 0%, #1a0a0a 100%)`,
          padding: "28px 32px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ margin: "0 0 4px", opacity: 0.6, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Off-Season
            </p>
            <h1 style={{ margin: "0 0 6px", fontSize: "1.75rem" }}>Transfer Window</h1>
            <p style={{ margin: 0, opacity: 0.75 }}>
              Season {seasonNumber} · {tradesLeft} trade{tradesLeft !== 1 ? "s" : ""} remaining
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              className="btn"
              onClick={handleContinueSeason}
            >
              Start Season {seasonNumber} →
            </button>
          </div>
        </div>
      </div>

      {/* Career stats strip */}
      {career && career.seasons > 0 && (
        <div className="card" style={{ marginBottom: 24, display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Career wins</p>
            <p style={{ margin: 0, fontSize: "1.75rem", fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--color-accent)" }}>
              {career.totalWins}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Best WDC</p>
            <p style={{ margin: 0, fontSize: "1.75rem", fontFamily: "var(--font-display)", fontWeight: 800 }}>
              P{career.bestWdcPosition ?? "—"}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Best WCC</p>
            <p style={{ margin: 0, fontSize: "1.75rem", fontFamily: "var(--font-display)", fontWeight: 800 }}>
              P{career.bestWccPosition ?? "—"}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Seasons</p>
            <p style={{ margin: 0, fontSize: "1.75rem", fontFamily: "var(--font-display)", fontWeight: 800 }}>
              {career.seasons}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Left: current roster */}
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.125rem" }}>
            Your Roster
            {tradesLeft === 0 && (
              <span style={{ marginLeft: 10, fontSize: "0.75rem", color: "var(--color-text-muted)", fontFamily: "var(--font-body)", fontWeight: 400 }}>
                No trades left
              </span>
            )}
          </h2>
          {SLOT_ORDER.map((slotId) => {
            const entity = getAssignedEntity(session, slotId);
            const isTradeable = TRADEABLE_SLOTS.includes(slotId);
            const isActive = activeSlot === slotId;
            const displayRating = toDisplayRating(entity?.computed_rating);
            const accentColor = entity?.accent_color ?? "var(--color-accent)";

            return (
              <div
                key={slotId}
                className="card"
                style={{
                  padding: "12px 14px",
                  marginBottom: 8,
                  border: isActive ? `2px solid var(--color-accent)` : `1px solid ${entity ? accentColor + "44" : "var(--color-border)"}`,
                  cursor: isTradeable && tradesLeft > 0 ? "pointer" : "default",
                }}
                onClick={() => {
                  if (!isTradeable || tradesLeft <= 0) return;
                  if (isActive) {
                    cancelTrade();
                  } else {
                    void loadCandidates(slotId);
                  }
                }}
                role={isTradeable ? "button" : undefined}
                tabIndex={isTradeable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (isTradeable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    if (isActive) cancelTrade();
                    else void loadCandidates(slotId);
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: accentColor,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                    }}
                  >
                    {entity?.display_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() ?? "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 2px", fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {SLOT_LABELS[slotId]}
                    </p>
                    <p style={{ margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entity?.display_name ?? "—"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {entity && isTradeable && (
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: accentColor }}>
                        {displayRating}
                      </span>
                    )}
                    {isTradeable && tradesLeft > 0 && (
                      <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: isActive ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                        {isActive ? "Cancel ✕" : "Trade →"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Right: transfer market */}
        <section>
          {!activeSlot && (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--color-text-muted)" }}>
              <p style={{ fontSize: "1.5rem", marginBottom: 8 }}>⟵</p>
              <p style={{ margin: 0 }}>
                {tradesLeft > 0
                  ? "Click a slot on the left to browse the transfer market"
                  : "All trades used. Start your next season!"}
              </p>
            </div>
          )}

          {activeSlot && (
            <>
              <h2 style={{ marginTop: 0, fontSize: "1.125rem" }}>
                Transfer Market — {SLOT_LABELS[activeSlot]}
              </h2>
              <p style={{ color: "var(--color-text-muted)", marginTop: 0, fontSize: "0.875rem" }}>
                Sorted by rating proximity to your current {SLOT_LABELS[activeSlot].toLowerCase()} ({currentDisplayRating}).
                Trades within ±{TRANSFER_RATING_WINDOW} are highlighted.
              </p>

              {loadingCandidates && (
                <p style={{ color: "var(--color-text-muted)" }}>Loading candidates…</p>
              )}

              {!loadingCandidates && pendingEntity && (
                <div
                  className="card"
                  style={{
                    marginBottom: 16,
                    background: "var(--color-accent)12",
                    border: "1px solid var(--color-accent)44",
                    padding: "14px 16px",
                  }}
                >
                  <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Confirm trade?</p>
                  <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                    Release <strong>{currentEntity?.display_name}</strong> ({currentDisplayRating}) →{" "}
                    Sign <strong>{pendingEntity.display_name}</strong> ({toDisplayRating(pendingEntity.computed_rating)})
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" className="btn" onClick={confirmTrade} disabled={confirming}>
                      Confirm
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setPendingEntity(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!loadingCandidates && candidates.map((entity) => {
                const incomingRating = toDisplayRating(entity.computed_rating);
                const delta = incomingRating - currentDisplayRating;
                const outOfWindow = Math.abs(delta) > TRANSFER_RATING_WINDOW;

                return (
                  <EntityCard
                    key={entity.id}
                    entity={entity}
                    selected={pendingEntity?.id === entity.id}
                    ratingDelta={delta}
                    disabled={outOfWindow}
                    onSelect={() => setPendingEntity(entity)}
                  />
                );
              })}

              {!loadingCandidates && candidates.length === 0 && (
                <p style={{ color: "var(--color-text-muted)" }}>No candidates found.</p>
              )}
            </>
          )}
        </section>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .transfer-layout { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
