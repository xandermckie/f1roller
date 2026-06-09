import { Navigate } from "react-router-dom";

import { useRollSession } from "@/hooks/useRollSession";
import { getAssignedEntity, isAssignmentComplete, isSetupComplete } from "@/lib/rollSession";
import { SLOT_LABELS } from "@/types";

export function TeamPage(): React.ReactElement {
  const { session } = useRollSession();

  if (!session.teamPayload && !isAssignmentComplete(session) && !isSetupComplete(session)) {
    return <Navigate to="/roll" replace />;
  }

  const titleSponsor = getAssignedEntity(session, "title_sponsor");
  const constructor = getAssignedEntity(session, "constructor");
  const teamMotto = getAssignedEntity(session, "team_motto");

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>Team Summary</h1>
      <div
        style={{
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          marginBottom: 32,
          minHeight: 160,
          background: `linear-gradient(to right, rgba(0,0,0,0.5), transparent), url(/images/hero/mercedes-cota.png) center/cover`,
          backgroundColor: "#333",
          padding: 32,
        }}
      >
        <h2 style={{ color: "#fff", margin: 0 }}>
          {titleSponsor?.display_name} {constructor?.display_name}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.8)", margin: "8px 0 0" }}>
          {teamMotto?.display_name}
        </p>
        {session.rolledDecade && (
          <p style={{ color: "rgba(255,255,255,0.65)", margin: "8px 0 0", fontSize: "0.875rem" }}>
            {session.rolledTeam?.display_name} · {session.rolledDecade}
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {(["driver_1", "driver_2", "reserve_driver"] as const).map((slot) => {
          const entity = getAssignedEntity(session, slot);
          return (
            <div key={slot} className="card">
              <p style={{ margin: "0 0 4px", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                {SLOT_LABELS[slot]}
              </p>
              <h3 style={{ margin: 0 }}>{entity?.display_name ?? "—"}</h3>
              {entity?.computed_rating !== undefined && (
                <p style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
                  Rating {(entity.computed_rating * 100).toFixed(0)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {session.simResult?.user_summary.team_efficiency_pct !== undefined && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 style={{ marginTop: 0 }}>Team Efficiency</h3>
          <p style={{ fontSize: "2rem", fontFamily: "var(--font-display)", margin: 0 }}>
            {session.simResult.user_summary.team_efficiency_pct}%
          </p>
          <p style={{ color: "var(--color-text-muted)", margin: "8px 0 0" }}>
            vs theoretical best possible team
          </p>
        </div>
      )}
    </div>
  );
}
