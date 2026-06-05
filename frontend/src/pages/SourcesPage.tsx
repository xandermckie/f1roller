import { useEffect, useState } from "react";

import { getSources, type SourceMeta } from "@/lib/api";

export function SourcesPage(): React.ReactElement {
  const [sources, setSources] = useState<SourceMeta[]>([]);

  useEffect(() => {
    void getSources().then(setSources).catch(() => undefined);
  }, []);

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>Sources &amp; Legal</h1>
      <div className="card" style={{ marginBottom: 24 }}>
        <p>
          <strong>F1 Roller</strong> is an unofficial, non-commercial fan project. It is not
          affiliated with Formula One, the FIA, or any teams or drivers.
        </p>
        <p style={{ marginBottom: 0 }}>
          Data is compiled from third-party sources listed below. Statistics may contain errors.
          Images are used under fair use for non-commercial fan purposes where not otherwise
          licensed via Wikimedia Commons.
        </p>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
            <th style={{ padding: 12 }}>Source</th>
            <th style={{ padding: 12 }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.name} style={{ borderBottom: "1px solid var(--color-border)" }}>
              <td style={{ padding: 12 }}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
              </td>
              <td style={{ padding: 12, color: "var(--color-text-muted)" }}>{s.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Hero Images</h3>
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
          User-provided photography for UI atmosphere. Driver portraits sourced from Wikimedia
          Commons where available; placeholder silhouettes otherwise. See docs/ATTRIBUTION.md in the
          repository for full image credits.
        </p>
      </div>
    </div>
  );
}
