import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useRollSession } from "@/hooks/useRollSession";
import { getBenchmark, simulateCompare } from "@/lib/api";
import type { BenchmarkResponse, SimResult } from "@/types";

export function ResultsPage(): React.ReactElement {
  const navigate = useNavigate();
  const { session, resetSession } = useRollSession();
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);
  const [compareReal, setCompareReal] = useState(false);
  const [realResult, setRealResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);

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

  if (!session.simResult) {
    return (
      <div className="container">
        <p>No results yet.</p>
        <Link to="/roll">Start rolling</Link>
      </div>
    );
  }

  const summary = session.simResult.user_summary;
  const activeResult = compareReal && realResult ? realResult : session.simResult;

  const copyRecap = (): void => {
    const text = `F1 Roller 2026: WDC P${summary.wdc_position}, WCC P${summary.wcc_position}, ${summary.wins} wins. Team efficiency ${summary.team_efficiency_pct ?? "—"}%.`;
    void navigator.clipboard.writeText(text);
  };

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <div
        style={{
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          marginBottom: 32,
          minHeight: 200,
          background: `linear-gradient(to top, rgba(0,0,0,0.8), transparent), url(/images/hero/mansell-senna-taxi.png) center/cover`,
          backgroundColor: "#222",
          padding: 32,
          color: "#fff",
        }}
      >
        <h1 style={{ margin: "0 0 16px" }}>Season Complete</h1>
        <div style={{ display: "flex", gap: 32 }}>
          <div>
            <p style={{ margin: 0, opacity: 0.8 }}>WDC</p>
            <p style={{ margin: 0, fontSize: "2rem", fontFamily: "var(--font-display)" }}>
              P{summary.wdc_position}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, opacity: 0.8 }}>WCC</p>
            <p style={{ margin: 0, fontSize: "2rem", fontFamily: "var(--font-display)" }}>
              P{summary.wcc_position}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, opacity: 0.8 }}>Wins</p>
            <p style={{ margin: 0, fontSize: "2rem", fontFamily: "var(--font-display)" }}>
              {summary.wins}
            </p>
          </div>
        </div>
      </div>

      {benchmark && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>vs Best Possible Team</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 12,
                  background: "var(--color-border)",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(summary.team_efficiency_pct ?? 0, 100)}%`,
                    height: "100%",
                    background: "var(--color-accent)",
                  }}
                />
              </div>
            </div>
            <strong>{summary.team_efficiency_pct ?? "—"}%</strong>
          </div>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", margin: "12px 0 0" }}>
            Benchmark pace: {benchmark.team_pace.toFixed(3)}
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={compareReal}
            onChange={(e) => setCompareReal(e.target.checked)}
          />
          Compare to Real 2026 Grid (historical rating proxy)
        </label>
        {loading && <p style={{ color: "var(--color-text-muted)" }}>Loading comparison…</p>}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>
          {compareReal ? "Real 2026 Grid WDC" : "Your Team WDC"}
        </h3>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {activeResult.final_wdc.slice(0, 10).map((entry) => (
            <li key={entry.name} style={{ padding: "4px 0", fontWeight: entry.is_user ? 600 : 400 }}>
              {entry.name} — {entry.points} pts
            </li>
          ))}
        </ol>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={copyRecap}>
          Copy Recap
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            resetSession();
            navigate("/");
          }}
        >
          Start New Session
        </button>
      </div>
    </div>
  );
}
