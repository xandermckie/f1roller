import { Link, Navigate } from "react-router-dom";

import { useRollSession } from "@/hooks/useRollSession";
import { buildSeasonRows } from "@/lib/pointsTable";

export function SeasonPage(): React.ReactElement {
  const { session } = useRollSession();

  if (!session.simResult) {
    return <Navigate to="/roll" replace />;
  }

  const rows = buildSeasonRows(session.simResult.races);

  return (
    <div className="container">
      <div
        style={{
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          marginBottom: 32,
          minHeight: 180,
          background: `linear-gradient(to right, rgba(0,0,0,0.6), transparent), url(/images/hero/spanish-gp-2024-start.png) center/cover`,
          backgroundColor: "#222",
          display: "flex",
          alignItems: "flex-end",
          padding: 32,
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: "#fff" }}>2026 Season Results</h1>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.8)" }}>
            WDC P{session.simResult.user_summary.wdc_position} · WCC P
            {session.simResult.user_summary.wcc_position} · {session.simResult.user_summary.wins} wins
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <Link to="/team" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Team Summary
        </Link>
        <Link to="/results" className="btn" style={{ textDecoration: "none" }}>
          Final Results
        </Link>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
              <th style={{ padding: "12px 8px" }}>Rd</th>
              <th style={{ padding: "12px 8px" }}>Grand Prix</th>
              <th style={{ padding: "12px 8px" }}>Pts</th>
              <th style={{ padding: "12px 8px" }}>WCC</th>
              <th style={{ padding: "12px 8px" }}>Leader</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.round} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "12px 8px" }}>{row.round}</td>
                <td style={{ padding: "12px 8px" }}>
                  <Link to={`/season/race/${row.round}`}>{row.meetingName}</Link>
                </td>
                <td style={{ padding: "12px 8px" }}>{row.userRacePoints}</td>
                <td style={{ padding: "12px 8px" }}>{row.cumulativeWcc}</td>
                <td style={{ padding: "12px 8px", color: "var(--color-text-muted)" }}>
                  {row.wdcLeader}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
