import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const HERO_IMAGES = [
  "/images/hero/red-bull-night-sparks.png",
  "/images/hero/senna-mclaren-cockpit.png",
  "/images/hero/barcelona-grid-2025.png",
  "/images/hero/monaco-hairpin-aerial.png",
];

export function LandingPage(): React.ReactElement {
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const heroSrc = HERO_IMAGES[heroIndex];

  return (
    <div className="container">
      <section
        style={{
          position: "relative",
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          minHeight: 420,
          display: "flex",
          alignItems: "flex-end",
          marginBottom: 48,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%), url(${heroSrc}) center/cover`,
            backgroundColor: "#1a1a1a",
          }}
        />
        <div style={{ position: "relative", padding: 48, maxWidth: 640 }}>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#fff", margin: "0 0 16px" }}>
            Roll your dream F1 team. Any era. One shot.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.125rem", margin: "0 0 28px" }}>
            Build a cross-era fantasy squad, simulate the full 2026 season, and see if you&apos;d win
            the championship.
          </p>
          <Link to="/roll" className="btn" style={{ textDecoration: "none", display: "inline-block" }}>
            Build Your Team
          </Link>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {[
          { title: "12 rolls", desc: "One roll per slot. No re-rolls, no edits." },
          { title: "2026 season", desc: "Full calendar from OpenF1. Realistic low-randomness sim." },
          { title: "Any era", desc: "Legends and modern stars in the same garage." },
        ].map((item) => (
          <div key={item.title} className="card">
            <h3 style={{ margin: "0 0 8px", color: "var(--color-accent)" }}>{item.title}</h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
