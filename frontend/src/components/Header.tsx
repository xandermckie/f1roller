import { Link } from "react-router-dom";

import { useTheme } from "@/hooks/useTheme";

export function Header(): React.ReactElement {
  const { theme, cycleTheme } = useTheme();

  return (
    <header
      style={{
        borderBottom: "1px solid var(--color-border)",
        padding: "16px 0",
        position: "sticky",
        top: 0,
        background: "var(--color-bg)",
        zIndex: 100,
      }}
    >
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <Link
          to="/"
          style={{
            textDecoration: "none",
            color: "var(--color-text)",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "1.25rem",
          }}
        >
          F1 Roller
        </Link>
        <nav style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link
            to="/ratings"
            style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", textDecoration: "none" }}
          >
            Ratings
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={cycleTheme}
            aria-label={`Theme: ${theme}. Click to cycle.`}
            style={{ padding: "8px 14px", fontSize: "0.8rem" }}
          >
            {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"}
          </button>
        </nav>
      </div>
    </header>
  );
}
