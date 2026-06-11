import { useState } from "react";
import { Navigate } from "react-router-dom";

import { useRollSession } from "@/hooks/useRollSession";
import { getAssignedEntity, isAssignmentComplete, isSetupComplete } from "@/lib/rollSession";
import { toDisplayRating } from "@/lib/ratingDisplay";
import { SLOT_LABELS, type RosterEntity } from "@/types";

function DriverPortrait({ entity }: { entity: RosterEntity }): React.ReactElement {
  const [imgFailed, setImgFailed] = useState(false);
  const accentColor = entity.accent_color ?? "var(--color-accent)";

  if (entity.portrait_path && !imgFailed) {
    return (
      <img
        src={entity.portrait_path}
        alt={entity.display_name}
        onError={() => setImgFailed(true)}
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          objectFit: "cover",
          border: `3px solid ${accentColor}`,
          margin: "0 auto 12px",
          display: "block",
        }}
      />
    );
  }

  return (
    <img
      src="/images/portraits/placeholder-silhouette.svg"
      alt={entity.display_name}
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        border: `3px solid ${accentColor}`,
        margin: "0 auto 12px",
        display: "block",
        background: "#2a2a2a",
      }}
    />
  );
}

function EntityBadge({ entity }: { entity: RosterEntity }): React.ReactElement {
  const accentColor = entity.accent_color ?? "var(--color-accent)";
  const initials = entity.display_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
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
        fontSize: "0.85rem",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export function TeamPage(): React.ReactElement {
  const { session } = useRollSession();

  if (!session.teamPayload && !isAssignmentComplete(session) && !isSetupComplete(session)) {
    return <Navigate to="/play" replace />;
  }

  const titleSponsor = getAssignedEntity(session, "title_sponsor");
  const constructor = getAssignedEntity(session, "constructor");
  const teamMotto = getAssignedEntity(session, "team_motto");

  const driver1 = getAssignedEntity(session, "driver_1");
  const driver2 = getAssignedEntity(session, "driver_2");
  const reserve = getAssignedEntity(session, "reserve_driver");

  const staffSlots = (["team_principal", "technical_director", "lead_engineer"] as const);
  const sponsorSlots = (["title_sponsor", "secondary_sponsor"] as const);
  const miscSlots = (["constructor", "engine", "livery_style", "team_motto"] as const);

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      {/* Hero banner */}
      <div
        style={{
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          marginBottom: 32,
          minHeight: 180,
          background: `linear-gradient(to right, rgba(0,0,0,0.65), rgba(0,0,0,0.3)), url(/images/hero/mercedes-cota.png) center/cover`,
          backgroundColor: "#333",
          padding: "32px 36px",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div>
          <h1 style={{ color: "#fff", margin: "0 0 6px", fontSize: "1.75rem" }}>
            {titleSponsor?.display_name ? `${titleSponsor.display_name} ` : ""}{constructor?.display_name ?? "Your Team"}
          </h1>
          {teamMotto?.display_name && (
            <p style={{ color: "rgba(255,255,255,0.75)", margin: 0, fontStyle: "italic" }}>
              "{teamMotto.display_name}"
            </p>
          )}
          {session.rolledDecade && (
            <p style={{ color: "rgba(255,255,255,0.5)", margin: "6px 0 0", fontSize: "0.8125rem" }}>
              {session.rolledTeam?.display_name} · {session.rolledDecade}
            </p>
          )}
        </div>
      </div>

      {/* Drivers */}
      <h2 style={{ marginBottom: 16 }}>Drivers</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[driver1, driver2, reserve].filter(Boolean).map((entity, i) => {
          if (!entity) return null;
          const slotId = ["driver_1", "driver_2", "reserve_driver"][i] as "driver_1" | "driver_2" | "reserve_driver";
          const accentColor = entity.accent_color ?? "var(--color-accent)";
          return (
            <div
              key={entity.id}
              className="card"
              style={{ textAlign: "center", borderTop: `4px solid ${accentColor}` }}
            >
              <DriverPortrait entity={entity} />
              <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {SLOT_LABELS[slotId]}
              </p>
              <h3 style={{ margin: "0 0 6px", fontSize: "1rem" }}>{entity.display_name}</h3>
              {entity.nationality && (
                <p style={{ margin: "0 0 4px", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                  {entity.nationality}
                </p>
              )}
              {entity.computed_rating !== undefined && (
                <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, color: accentColor }}>
                  {toDisplayRating(entity.computed_rating)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Staff */}
      <h2 style={{ marginBottom: 16 }}>Staff</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
        {staffSlots.map((slotId) => {
          const entity = getAssignedEntity(session, slotId);
          if (!entity) return null;
          return (
            <div key={slotId} className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px" }}>
              <EntityBadge entity={entity} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px", fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {SLOT_LABELS[slotId]}
                </p>
                <strong>{entity.display_name}</strong>
              </div>
              {entity.computed_rating !== undefined && (
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: entity.accent_color ?? "var(--color-accent)" }}>
                  {toDisplayRating(entity.computed_rating)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Car & Sponsors */}
      <h2 style={{ marginBottom: 16 }}>Car & Sponsors</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
        {[...miscSlots, ...sponsorSlots].map((slotId) => {
          const entity = getAssignedEntity(session, slotId);
          if (!entity) return null;
          const accentColor = entity.accent_color ?? "var(--color-accent)";
          return (
            <div key={slotId} className="card" style={{ padding: "14px 16px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {SLOT_LABELS[slotId]}
              </p>
              <strong style={{ color: accentColor }}>{entity.display_name}</strong>
              {entity.stats_summary && (
                <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                  {entity.stats_summary}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Team Efficiency */}
      {session.simResult?.user_summary.team_efficiency_pct !== undefined && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Team Efficiency</h3>
          <p style={{ fontSize: "2.5rem", fontFamily: "var(--font-display)", fontWeight: 800, margin: "0 0 4px", color: "var(--color-accent)" }}>
            {session.simResult.user_summary.team_efficiency_pct}%
          </p>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            vs theoretical best possible team
          </p>
        </div>
      )}
    </div>
  );
}
