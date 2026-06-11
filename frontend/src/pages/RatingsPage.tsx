import { useEffect, useRef, useState } from "react";

import { getRatings } from "@/lib/api";
import type { RatedEntity, RatingsResponse } from "@/types";

type Tab = "drivers" | "constructors" | "engines" | "personnel";

const TAB_LABELS: Record<Tab, string> = {
  drivers: "Drivers",
  constructors: "Constructors",
  engines: "Engines",
  personnel: "Staff",
};

function RatingPip({ value }: { value: number }): React.ReactElement {
  const color =
    value >= 75 ? "#22c55e" : value >= 50 ? "#f59e0b" : "var(--color-accent)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
      <div style={{ flex: 1, height: 6, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8125rem", color, width: 26, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function EntityRow({ entity, rank }: { entity: RatedEntity; rank: number }): React.ReactElement {
  const [imgFailed, setImgFailed] = useState(false);
  const accentColor = "#e10600";

  return (
    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
      <td style={{ padding: "10px 8px", fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--color-text-muted)", width: 36 }}>
        {rank}
      </td>
      <td style={{ padding: "10px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {entity.entity_type === "driver" && (
            entity.portrait_path && !imgFailed ? (
              <img
                src={entity.portrait_path}
                alt={entity.display_name}
                onError={() => setImgFailed(true)}
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${accentColor}` }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: accentColor,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                }}
              >
                {entity.display_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
            )
          )}
          <div>
            <strong style={{ fontSize: "0.9375rem" }}>{entity.display_name}</strong>
            {(entity.nationality || entity.sub_type) && (
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                {[entity.nationality, entity.sub_type?.replace(/_/g, " ")].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </td>
      <td style={{ padding: "10px 8px" }}>
        <RatingPip value={entity.display_rating} />
      </td>
      {entity.entity_type === "driver" && (
        <>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem" }}>{entity.wins}</td>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem" }}>{entity.poles}</td>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem" }}>{entity.championships}</td>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            {entity.avg_finish != null ? entity.avg_finish.toFixed(1) : "—"}
          </td>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            {entity.peak_year ?? "—"}
          </td>
        </>
      )}
      {entity.entity_type === "constructor" && (
        <>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem" }}>{entity.wins}</td>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem" }}>{entity.poles}</td>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem" }}>{entity.championships}</td>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            {entity.peak_year ?? "—"}
          </td>
        </>
      )}
      {entity.entity_type === "engine" && (
        <>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem" }}>{entity.wins}</td>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            {entity.peak_year ?? "—"}
          </td>
        </>
      )}
      {entity.entity_type === "personnel" && (
        <>
          <td style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.875rem" }}>{entity.championships}</td>
        </>
      )}
    </tr>
  );
}

function TableHeader({ tab }: { tab: Tab }): React.ReactElement {
  const th = (label: string, centered = false): React.ReactElement => (
    <th style={{ padding: "10px 8px", textAlign: centered ? "center" : "left", fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
      {label}
    </th>
  );

  return (
    <thead>
      <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
        {th("#")}
        {th("Name")}
        {th("Rating")}
        {tab === "drivers" && <>{th("Wins", true)}{th("Poles", true)}{th("Titles", true)}{th("Avg Finish", true)}{th("Peak Year", true)}</>}
        {tab === "constructors" && <>{th("Wins", true)}{th("Poles", true)}{th("Titles", true)}{th("Peak Year", true)}</>}
        {tab === "engines" && <>{th("Wins", true)}{th("Peak Year", true)}</>}
        {tab === "personnel" && <>{th("Titles", true)}</>}
      </tr>
    </thead>
  );
}

export function RatingsPage(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("drivers");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [data, setData] = useState<RatingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getRatings(debouncedSearch)
      .then(setData)
      .catch(() => setError("Could not load ratings. Make sure the backend is running."))
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  const entities: RatedEntity[] = data ? data[tab] : [];

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      {/* Hero */}
      <div
        style={{
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          marginBottom: 28,
          background: `linear-gradient(135deg, #0d1117 0%, #1a0505 100%)`,
          padding: "28px 32px",
        }}
      >
        <h1 style={{ color: "#fff", margin: "0 0 6px" }}>Entity Ratings</h1>
        <p style={{ color: "rgba(255,255,255,0.65)", margin: 0 }}>
          All drivers, teams, engines and staff ranked by computed era-adjusted rating.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["drivers", "constructors", "engines", "personnel"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: tab === t ? "var(--color-accent)" : "transparent",
                color: tab === t ? "#fff" : "var(--color-text)",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              {TAB_LABELS[t]}
              {data && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>({data[t].length})</span>
              )}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            minWidth: 200,
          }}
        />
        {loading && <span style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>Loading…</span>}
      </div>

      {error && <p style={{ color: "var(--color-accent)" }}>{error}</p>}

      {!loading && entities.length === 0 && !error && (
        <p style={{ color: "var(--color-text-muted)" }}>No results found.</p>
      )}

      {entities.length > 0 && (
        <div className="card" style={{ overflowX: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TableHeader tab={tab} />
            <tbody>
              {entities.map((entity, i) => (
                <EntityRow key={entity.id} entity={entity} rank={i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
