interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps): React.ReactElement {
  const pct = Math.round((current / total) * 100);
  return (
    <div style={{ marginBottom: 24 }} aria-label={`Progress ${current} of ${total}`}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
          marginBottom: 8,
        }}
      >
        <span>
          Slot {current} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--color-border)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--color-accent)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
