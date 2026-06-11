import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useRollSession } from "@/hooks/useRollSession";
import { getBenchmark, simulateCompare } from "@/lib/api";
import { advanceToNextSeason, getAssignedEntity } from "@/lib/rollSession";
import { toDisplayRating } from "@/lib/ratingDisplay";
import type { BenchmarkResponse, SimResult } from "@/types";

function getHeroImage(wins: number): string {
  if (wins >= 14) return "/images/hero/antonelli-celebration.png";
  if (wins >= 8) return "/images/hero/alonso-renault-celebration.png";
  return "/images/hero/mclaren-parc-ferme.png";
}

function getResultLabel(wins: number): string {
  if (wins === 16) return "PERFECT SEASON";
  if (wins >= 14) return "DOMINANT";
  if (wins >= 10) return "CHAMPIONSHIP WINNER";
  if (wins >= 6) return "RACE WINNER";
  if (wins >= 2) return "POINTS SCORER";
  return "BACKMARKER";
}

export function ResultsPage(): React.ReactElement {
  const navigate = useNavigate();
  const { session, resetSession, updateSession } = useRollSession();
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);
  const [compareReal, setCompareReal] = useState(false);
  const [realResult, setRealResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void getBenchmark().then(setBenchmark).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!compareReal || !session.teamPayload) return;
    setLoading(true);
    void simulateCompare(session.teamPayload, session.sessionSeed)
      .then((r) => setRealResult(r.real_grid))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [compareReal, session.teamPayload, session.sessionSeed]);

  if (!session.simResult && session.simProgress.revealedRaces.length === 0) {
    return (
      <div className="container">
        <p>No results yet.</p>
        <Link to="/play">Start playing</Link>
      </div>
    );
  }

  const summary =
    session.simResult?.user_summary ?? {
      wdc_position: 0,
      wcc_position: 0,
      wins: session.simProgress.revealedRaces.filter((race) => race.user_race_points >= 25).length,
      poles: 0,
    };
  const activeResult = compareReal && realResult ? realResult : session.simResult;
  const heroImage = getHeroImage(summary.wins);
  const resultLabel = getResultLabel(summary.wins);

  const driver1 = getAssignedEntity(session, "driver_1");
  const driver2 = getAssignedEntity(session, "driver_2");
  const constructor = getAssignedEntity(session, "constructor");

  const copyRecap = (): void => {
    const text = `F1 Roller 2026: WDC P${summary.wdc_position}, WCC P${summary.wcc_position}, ${summary.wins}/16 wins. Team efficiency ${summary.team_efficiency_pct ?? "—"}%.`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="container" style={{ maxWidth: 820 }}>
      {/* Hero */}
      <div
        style={{
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          marginBottom: 28,
          background: `linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 60%, transparent 100%), url(${heroImage}) center/cover`,
          backgroundColor: "#111",
          padding: "48px 36px 32px",
          color: "#fff",
          minHeight: 260,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 20,
            background: "var(--color-accent)",
            fontSize: "0.7rem",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            marginBottom: 12,
            alignSelf: "flex-start",
          }}
        >
          {resultLabel}
        </span>
        <h1 style={{ margin: "0 0 16px", fontSize: "2rem" }}>Season Complete</h1>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, opacity: 0.7, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Wins</p>
            <p style={{ margin: 0, fontSize: "2.25rem", fontFamily: "var(--font-display)", fontWeight: 800 }}>
              {summary.wins}<span style={{ fontSize: "1.1rem", opacity: 0.6 }}> / 16</span>
            </p>
          </div>
          {session.simResult && (
            <>
              <div>
                <p style={{ margin: 0, opacity: 0.7, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>WDC</p>
                <p style={{ margin: 0, fontSize: "2.25rem", fontFamily: "var(--font-display)", fontWeight: 800 }}>
                  P{summary.wdc_position}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, opacity: 0.7, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>WCC</p>
                <p style={{ margin: 0, fontSize: "2.25rem", fontFamily: "var(--font-display)", fontWeight: 800 }}>
                  P{summary.wcc_position}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Team summary strip */}
      {(driver1 || driver2 || constructor) && (
        <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16, padding: "14px 20px" }}>
          {[driver1, driver2].filter(Boolean).map((entity) => {
            if (!entity) return null;
            return (
              <div key={entity.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: entity.accent_color ?? "var(--color-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                  }}
                >
                  {entity.display_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>{entity.display_name}</p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                    {toDisplayRating(entity.computed_rating)}
                  </p>
                </div>
              </div>
            );
          })}
          {driver1 && driver2 && constructor && (
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Chassis</p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>{constructor.display_name}</p>
            </div>
          )}
        </div>
      )}

      {/* Efficiency bar */}
      {benchmark && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>vs Best Possible Team</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 10,
                  background: "var(--color-border)",
                  borderRadius: 5,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(summary.team_efficiency_pct ?? 0, 100)}%`,
                    height: "100%",
                    background: "var(--color-accent)",
                    borderRadius: 5,
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
            </div>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", color: "var(--color-accent)" }}>
              {summary.team_efficiency_pct ?? "—"}%
            </strong>
          </div>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem", margin: "10px 0 0" }}>
            Benchmark team pace: {benchmark.team_pace.toFixed(3)}
          </p>
        </div>
      )}

      {/* Real grid comparison toggle */}
      <div className="card" style={{ marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={compareReal}
            onChange={(e) => setCompareReal(e.target.checked)}
          />
          <span>Compare to Real 2026 Grid (historical rating proxy)</span>
        </label>
        {loading && <p style={{ color: "var(--color-text-muted)", margin: "8px 0 0", fontSize: "0.875rem" }}>Loading comparison…</p>}
      </div>

      {/* WDC standings */}
      {activeResult && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>
            {compareReal ? "Real 2026 Grid — WDC" : "Final WDC Standings"}
          </h3>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            {activeResult.final_wdc.slice(0, 10).map((entry, i) => (
              <li
                key={entry.name}
                style={{
                  padding: "8px 0",
                  fontWeight: entry.is_user ? 700 : 400,
                  borderBottom: i < 9 ? "1px solid var(--color-border)" : "none",
                  color: entry.is_user ? "var(--color-text)" : "var(--color-text-muted)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  {entry.name}
                  {entry.is_user && <span style={{ marginLeft: 8, color: "var(--color-accent)", fontSize: "0.75rem" }}>YOU</span>}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: entry.is_user ? 700 : 400 }}>
                  {entry.points} pts
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary" onClick={copyRecap}>
          {copied ? "Copied!" : "Copy Recap"}
        </button>
        <Link to="/season" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Season Races
        </Link>
        {/* Continue to next season with same team */}
        {session.simResult && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ borderColor: "#22c55e44", color: "#22c55e" }}
            onClick={() => {
              const next = advanceToNextSeason(session);
              updateSession(next);
              navigate("/transfer");
            }}
          >
            ▶ Season {(session.career?.seasons ?? 0) + 2} — Transfer Window
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            resetSession();
            navigate("/");
          }}
        >
          Start Fresh
        </button>
      </div>
    </div>
  );
}
