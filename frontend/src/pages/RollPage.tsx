import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { ProgressBar } from "@/components/ProgressBar";
import { RollCard } from "@/components/RollCard";
import { useRollSession } from "@/hooks/useRollSession";
import { getRoll } from "@/lib/rollSession";
import { SLOT_LABELS, SLOT_ORDER } from "@/types";

export function RollPage(): React.ReactElement {
  const navigate = useNavigate();
  const { session, currentSlotId, isComplete, rollCurrentSlot, advanceSlot, rolling, error } =
    useRollSession();
  const [lastRevealed, setLastRevealed] = useState<string | null>(null);

  if (session.phase !== "rolling" && isComplete) {
    return <Navigate to="/assign" replace />;
  }

  const slotIndex = session.currentSlotIndex;
  const slotId = currentSlotId;
  const currentEntity = slotId ? getRoll(session, slotId) : undefined;

  const handleRoll = async (): Promise<void> => {
    const entity = await rollCurrentSlot();
    if (entity) {
      setLastRevealed(entity.id);
    }
  };

  const handleContinue = (): void => {
    setLastRevealed(null);
    if (slotIndex >= SLOT_ORDER.length - 1) {
      navigate("/assign");
    } else {
      advanceSlot();
    }
  };

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <ProgressBar current={Math.min(slotIndex + 1, SLOT_ORDER.length)} total={SLOT_ORDER.length} />
      <RollCard
        entity={currentEntity ?? null}
        revealed={Boolean(currentEntity && lastRevealed === currentEntity.id)}
        rolling={rolling}
        slotLabel={slotId ? SLOT_LABELS[slotId] : ""}
      />
      {error && (
        <p role="alert" style={{ color: "var(--color-accent)", textAlign: "center" }}>
          {error}
        </p>
      )}
      <div style={{ textAlign: "center", marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
        {!currentEntity ? (
          <button
            type="button"
            className="btn"
            onClick={() => void handleRoll()}
            disabled={rolling || !slotId}
          >
            {rolling ? "Rolling…" : "Roll"}
          </button>
        ) : (
          <button type="button" className="btn" onClick={handleContinue}>
            {slotIndex >= SLOT_ORDER.length - 1 ? "Finish" : "Continue"}
          </button>
        )}
      </div>
    </div>
  );
}
