#!/usr/bin/env python3
"""Download Wikimedia portraits — stub for v1 manual curation."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "frontend" / "public" / "images" / "portraits"
ATTRIBUTION = ROOT / "docs" / "ATTRIBUTION.md"


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    print(f"Portrait directory ready: {DEST}")
    print("Add entity_id,wikimedia_file_title entries to scripts/portraits.csv and implement download.")


if __name__ == "__main__":
    main()
