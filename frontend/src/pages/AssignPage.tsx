import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useRollSession } from "@/hooks/useRollSession";
import { simulate } from "@/lib/api";
import { getRoll, isRollComplete } from "@/lib/rollSession";
import { SLOT_LABELS, type SlotId } from "@/types";

const TEAM_COMPOSITION_SLOTS: SlotId[] = [
  "constructor",
  "engine",
  "team_principal",
  "lead_engineer",
  "title_sponsor",
];

export function AssignPage(): React.ReactElement {
  const navigate = useNavigate();
  const { session, swapDrivers, lockTeam, updateSession } = useRollSession();
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isRollComplete(session)) {
    return <Navigate to="/roll" replace />;
  }

  const d1 = session.driverOrderSwapped ? getRoll(session, "driver_2") : getRoll(session, "driver_1");
  const d2 = session.driverOrderSwapped ? getRoll(session, "driver_1") : getRoll(session, "driver_2");

  const handleSimulate = async (): Promise<void> => {
    const result = lockTeam();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSimulating(true);
    setError(null);
    try {
      const simResult = await simulate(result.payload, session.sessionSeed);
      updateSession({ ...session, phase: "complete", teamPayload: result.payload, simResult });
      navigate("/season");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <h1 style={{ marginTop: 0 }}>Confirm Your Team</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        Swap driver order if needed — this is your only allowed change.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Driver Lineup</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <strong>{SLOT_LABELS.driver_1}</strong>
            <p style={{ margin: "4px 0 0" }}>{d1?.display_name ?? "—"}</p>
          </div>
          <div>
            <strong>{SLOT_LABELS.driver_2}</strong>
            <p style={{ margin: "4px 0 0" }}>{d2?.display_name ?? "—"}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginTop: 16 }}
          onClick={swapDrivers}
        >
          Swap D1 / D2
        </button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Team Composition</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {TEAM_COMPOSITION_SLOTS.map((slot) => {
            const entity = getRoll(session, slot);
            return (
              <li key={slot} style={{ padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
                  {SLOT_LABELS[slot]}
                </span>
                <br />
                <strong>{entity?.display_name ?? "—"}</strong>
              </li>
            );
          })}
        </ul>
      </div>

      {error && <p role="alert" style={{ color: "var(--color-accent)" }}>{error}</p>}

      <button type="button" className="btn" onClick={() => void handleSimulate()} disabled={simulating}>
        {simulating ? "Simulating Season…" : "Lock Team & Simulate"}
      </button>
    </div>
  );
}
