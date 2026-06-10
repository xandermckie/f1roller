import { Link, Navigate, useParams } from "react-router-dom";

import { useRollSession } from "@/hooks/useRollSession";

const CIRCUIT_HERO: Record<string, string> = {
  "Monte Carlo": "/images/hero/alpine-monaco.png",
  Monaco: "/images/hero/alpine-monaco.png",
  Austin: "/images/hero/mercedes-cota.png",
  Sakhir: "/images/hero/spain-gp-start-2025.png",
};

export function RaceDetailPage(): React.ReactElement {
  const { round } = useParams<{ round: string }>();
  const { session } = useRollSession();

  const races = session.simResult?.races ?? session.simProgress.revealedRaces;
  if (races.length === 0) {
    return <Navigate to="/play" replace />;
  }

  const race = races.find((r) => r.round === Number(round));
  if (!race) {
    return (
      <div className="container">
        <p>Race not found.</p>
        <Link to="/season">Back to season</Link>
      </div>
    );
  }

  const circuitKey = race.circuit_key;
  const mapSrc = circuitKey
    ? `/images/circuits/${circuitKey}.svg`
    : race.circuit_short_name && CIRCUIT_HERO[race.circuit_short_name]
      ? CIRCUIT_HERO[race.circuit_short_name]
      : "/images/hero/grandstands-modern.png";

  const top10 = race.positions.filter((p) => p.position <= 10);
  const userPos = race.positions.find((p) => p.is_user_team);
  const leader = race.positions[0];

  return (
    <div className="container">
      <Link to="/season" style={{ fontSize: "0.875rem" }}>
        ← Season
      </Link>
      <h1 style={{ margin: "16px 0 8px" }}>{race.meeting_name}</h1>
      <p style={{ color: "var(--color-text-muted)", margin: "0 0 24px" }}>
        {race.circuit_short_name ?? "Circuit"} · Round {race.round}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginBottom: 32,
        }}
      >
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Circuit</h3>
          <img
            src={mapSrc}
            alt={`${race.circuit_short_name ?? "Circuit"} map`}
            style={{ width: "100%", maxHeight: 240, objectFit: "contain" }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/hero/grandstands-modern.png";
            }}
          />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your Result</h3>
          <p style={{ fontSize: "2.5rem", fontFamily: "var(--font-display)", margin: "0 0 8px" }}>
            P{userPos?.position ?? "—"}
          </p>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            {race.user_race_points} constructor points
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Top 10</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {top10.map((p) => (
            <span
              key={`${p.position}-${p.team_name}`}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: p.is_user_team ? "var(--color-accent)" : "var(--color-border)",
                color: p.is_user_team ? "#fff" : "var(--color-text)",
                fontSize: "0.875rem",
              }}
            >
              P{p.position} {p.team_name}
            </span>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Head-to-Head</h3>
        <p>
          Your team vs race winner: P{userPos?.position ?? "—"} vs P1 {leader?.team_name ?? "—"}
        </p>
        <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
          Points gap: {leader ? (leader.points - (userPos?.points ?? 0)) : 0} to the lead
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Full Grid</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Pos</th>
              <th style={{ padding: 8 }}>Drivers</th>
              <th style={{ padding: 8 }}>Team</th>
              <th style={{ padding: 8 }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {race.positions.map((p) => (
              <tr
                key={`${p.position}-${p.team_name}`}
                style={{
                  borderBottom: "1px solid var(--color-border)",
                  fontWeight: p.is_user_team ? 600 : 400,
                }}
              >
                <td style={{ padding: 8 }}>{p.position}</td>
                <td style={{ padding: 8 }}>{p.driver_name}</td>
                <td style={{ padding: 8 }}>{p.team_name}</td>
                <td style={{ padding: 8 }}>{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
