import type { RolledEntity } from "@/types";

interface RollCardProps {
  entity: RolledEntity | null;
  revealed: boolean;
  rolling?: boolean;
  slotLabel: string;
}

export function RollCard({ entity, revealed, rolling = false, slotLabel }: RollCardProps): React.ReactElement {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className="card"
      aria-live="polite"
      style={{
        minHeight: 320,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        perspective: "1000px",
      }}
    >
      <p style={{ color: "var(--color-text-muted)", margin: "0 0 16px", fontSize: "0.875rem" }}>
        {slotLabel}
      </p>
      {entity && revealed ? (
        <div
          style={{
            animation: reducedMotion ? "none" : "reveal 0.6s ease-out",
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "var(--color-border)",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
              fontFamily: "var(--font-display)",
            }}
          >
            {entity.display_name.charAt(0)}
          </div>
          <h2 style={{ margin: "0 0 8px" }}>{entity.display_name}</h2>
          {entity.peak_year && (
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 20,
                background: "var(--color-border)",
                fontSize: "0.75rem",
                marginBottom: 8,
              }}
            >
              Peak {entity.peak_year}
            </span>
          )}
          {entity.stats_summary && (
            <p style={{ color: "var(--color-text-muted)", margin: "8px 0 0" }}>{entity.stats_summary}</p>
          )}
          {entity.computed_rating !== undefined && entity.entity_type === "driver" && (
            <p style={{ margin: "8px 0 0", fontWeight: 600 }}>
              Rating {(entity.computed_rating * 100).toFixed(0)}
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            width: 200,
            height: 280,
            border: "2px dashed var(--color-border)",
            borderRadius: "var(--radius-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-muted)",
            animation: rolling && !reducedMotion ? "rollPulse 0.8s ease-in-out infinite" : undefined,
          }}
        >
          {rolling ? "Rolling…" : "Tap Roll to reveal"}
        </div>
      )}
      <style>{`
        @keyframes reveal {
          from { opacity: 0; transform: rotateY(90deg) translateY(12px); }
          to { opacity: 1; transform: rotateY(0) translateY(0); }
        }
        @keyframes rollPulse {
          0%, 100% { opacity: 0.6; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}
