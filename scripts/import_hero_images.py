#!/usr/bin/env python3
"""Copy 16 user hero images into frontend/public/images/hero/."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "frontend" / "public" / "images" / "hero"
ASSETS_DIRS = [
    ROOT / "assets",
    Path.home() / ".cursor" / "projects" / "c-Users-amcki-Downloads-f1roller" / "assets",
]

MAPPINGS = [
    ("images__1_", "mclaren-parc-ferme.png"),
    ("images__3_", "hungaroring-pack.png"),
    ("images__2_", "lotus-senna-yellow.png"),
    ("images-3372e6e5", "mercedes-cota.png"),
    ("GettyImages-72115275", "alonso-renault-celebration.png"),
    ("2025-start-barcelona", "barcelona-grid-2025.png"),
    ("GettyImages-927907236", "senna-mclaren-cockpit.png"),
    ("HKDa2i-WYAE43HE", "alpine-monaco.png"),
    ("2268876089", "antonelli-celebration.png"),
    ("0x0-907c6190", "red-bull-night-sparks.png"),
    ("20200309-F1-Round-Up", "ferrari-modern.png"),
    ("race-start-of-the-formula-1-spain", "spain-gp-start-2025.png"),
    ("GettyImages-2234147338", "mansell-senna-taxi.png"),
    ("GettyImages-1228294", "monaco-hairpin-aerial.png"),
    ("2024-spanish-gp-race-start", "spanish-gp-2024-start.png"),
    ("GettyImages-2217000310", "grandstands-modern.png"),
]


def find_asset(prefix: str) -> Path | None:
    for assets_dir in ASSETS_DIRS:
        if not assets_dir.exists():
            continue
        for path in assets_dir.rglob("*"):
            if path.is_file() and prefix in path.name and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                return path
    return None


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    copied = 0
    for prefix, dest_name in MAPPINGS:
        source = find_asset(prefix)
        target = DEST / dest_name
        if source:
            shutil.copy2(source, target)
            print(f"Copied {source.name} -> {dest_name}")
            copied += 1
        else:
            print(f"Missing asset for prefix: {prefix}")
    print(f"Done: {copied}/{len(MAPPINGS)} images copied to {DEST}")


if __name__ == "__main__":
    main()
