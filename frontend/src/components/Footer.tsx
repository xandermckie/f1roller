import { Link } from "react-router-dom";

export function Footer(): React.ReactElement {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-border)",
        padding: "24px 0",
        marginTop: "48px",
        textAlign: "center",
        fontSize: "0.875rem",
        color: "var(--color-text-muted)",
      }}
    >
      <div className="container">
        <p style={{ margin: "0 0 8px" }}>
          Created by{" "}
          <a href="https://github.com/xandermckie" target="_blank" rel="noopener noreferrer">
            Xander McKie
          </a>
        </p>
        <p style={{ margin: 0 }}>
          <Link to="/sources">Data sources &amp; legal</Link>
          {" · "}
          Unofficial fan project — not affiliated with Formula One, FIA, or teams.
        </p>
      </div>
    </footer>
  );
}
