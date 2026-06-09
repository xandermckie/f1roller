import { useEffect, useRef } from "react";

import { RosterEntityCard } from "@/components/RosterEntityCard";
import type { RosterEntity } from "@/types";

interface RosterPickerModalProps {
  open: boolean;
  title: string;
  entities: RosterEntity[];
  onSelect: (entityId: string) => void;
  onClose: () => void;
}

export function RosterPickerModal({
  open,
  title,
  entities,
  onSelect,
  onClose,
}: RosterPickerModalProps): React.ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        padding: 24,
        maxWidth: 560,
        width: "90vw",
        maxHeight: "80vh",
        overflow: "auto",
        background: "var(--color-surface)",
        color: "var(--color-text)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.125rem" }}>{title}</h2>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          aria-label="Close picker"
          style={{ padding: "4px 10px", minWidth: "auto" }}
        >
          ✕
        </button>
      </div>
      {entities.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          No eligible picks for this role in this era. Try rerolling team or decade.
        </p>
      ) : (
        entities.map((entity) => (
          <RosterEntityCard
            key={entity.id}
            entity={entity}
            onSelect={() => onSelect(entity.id)}
          />
        ))
      )}
    </dialog>
  );
}
