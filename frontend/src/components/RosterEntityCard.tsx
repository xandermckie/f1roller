import { useState } from "react";

import { getEntityDetail, type EntityDetail } from "@/lib/api";
import type { RosterEntity } from "@/types";

export interface RosterEntityCardProps {
  entity: RosterEntity;
  selected?: boolean;
  assigned?: boolean;
  disabled?: boolean;
  displayRating?: number;
  onSelect?: () => void;
  compact?: boolean;
}

function EntityAvatar({
  entity,
  size = 48,
}: {
  entity: RosterEntity;
  size?: number;
}): React.ReactElement {
  const [imgFailed, setImgFailed] = useState(false);
  const accentColor = entity.accent_color ?? "var(--color-accent)";
  const initials = entity.display_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (entity.portrait_path && !imgFailed) {
    return (
      <img
        src={entity.portrait_path}
        alt={entity.display_name}
        onError={() => setImgFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: `2px solid ${accentColor}`,
        }}
      />
    );
  }

  const isDriver = ["driver", "reserve_driver"].includes(entity.entity_type) ||
    entity.assignable_slots?.some((s) => s.startsWith("driver"));

  if (isDriver) {
    return (
      <img
        src="/images/portraits/placeholder-silhouette.svg"
        alt={entity.display_name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          flexShrink: 0,
          border: `2px solid ${accentColor}`,
          background: "#2a2a2a",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: accentColor,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: size * 0.35,
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

export function RosterEntityCard({
  entity,
  selected = false,
  assigned = false,
  disabled = false,
  displayRating,
  onSelect,
  compact = false,
}: RosterEntityCardProps): React.ReactElement {
  const ratingLabel =
    displayRating ??
    (typeof entity.computed_rating === "number"
      ? Math.round(entity.computed_rating * 100)
      : undefined);
  const interactive = Boolean(onSelect && !assigned && !disabled);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const accentColor = entity.accent_color ?? "var(--color-accent)";

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
        opacity: assigned || disabled ? 0.45 : 1,
        border: selected
          ? `2px solid ${accentColor}`
          : `1px solid var(--color-border)`,
        cursor: interactive ? "pointer" : "default",
        padding: compact ? "10px 12px" : 16,
        marginBottom: 8,
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        boxShadow: selected ? `0 0 0 3px ${accentColor}22` : undefined,
      }}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 12 }}>
        <EntityAvatar entity={entity} size={compact ? 36 : 48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entity.display_name}
              </strong>
              {entity.role_label && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {entity.role_label}
                </span>
              )}
            </div>
            {ratingLabel !== undefined && (
              <span
                style={{
                  fontSize: "0.875rem",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  color: accentColor,
                  flexShrink: 0,
                }}
              >
                {ratingLabel}
              </span>
            )}
          </div>
          {!compact && (
            <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              {[entity.nationality, entity.peak_year ? `Peak ${entity.peak_year}` : null, entity.stats_summary]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>
      {!compact && (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 10, fontSize: "0.75rem", padding: "4px 8px" }}
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
