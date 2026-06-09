import { useState } from "react";

import { getEntityDetail, type EntityDetail } from "@/lib/api";
import type { RosterEntity } from "@/types";

export interface RosterEntityCardProps {
  entity: RosterEntity;
  selected?: boolean;
  assigned?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

export function RosterEntityCard({
  entity,
  selected = false,
  assigned = false,
  onSelect,
  compact = false,
}: RosterEntityCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleExpand = async (): Promise<void> => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (detail || entity.entity_type === "livery" || entity.entity_type === "motto") {
      return;
    }
    setDetailLoading(true);
    try {
      const data = await getEntityDetail(entity.id);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        opacity: assigned ? 0.45 : 1,
        border: selected ? "2px solid var(--color-accent)" : undefined,
        cursor: onSelect && !assigned ? "pointer" : "default",
        padding: compact ? 12 : 16,
        marginBottom: 8,
      }}
      onClick={onSelect && !assigned ? onSelect : undefined}
      onKeyDown={
        onSelect && !assigned
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      role={onSelect && !assigned ? "button" : undefined}
      tabIndex={onSelect && !assigned ? 0 : undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div>
          <strong>{entity.display_name}</strong>
          {entity.role_label && (
            <span
              style={{
                marginLeft: 8,
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
              }}
            >
              {entity.role_label}
            </span>
          )}
        </div>
        {entity.computed_rating !== undefined && entity.computed_rating !== null && (
          <span style={{ fontSize: "0.875rem", whiteSpace: "nowrap" }}>
            {(entity.computed_rating * 100).toFixed(0)}
          </span>
        )}
      </div>
      {!compact && (
        <>
          <p style={{ margin: "6px 0 0", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            {[entity.nationality, entity.peak_year ? `Peak ${entity.peak_year}` : null, entity.stats_summary]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 8, fontSize: "0.75rem", padding: "4px 8px" }}
            onClick={(event) => {
              event.stopPropagation();
              void handleExpand();
            }}
          >
            {expanded ? "Hide stats" : "View stats"}
          </button>
          {expanded && (
            <div style={{ marginTop: 8, fontSize: "0.8125rem" }}>
              {detailLoading && <p style={{ margin: 0 }}>Loading…</p>}
              {detail && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {Object.entries(detail.stats_json).map(([key, value]) => (
                    <li key={key}>
                      {key.replaceAll("_", " ")}: {value}
                    </li>
                  ))}
                </ul>
              )}
              {!detailLoading && !detail && entity.stats_summary && (
                <p style={{ margin: 0 }}>{entity.stats_summary}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
