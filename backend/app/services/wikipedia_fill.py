"""Wikipedia gap-fill for missing driver records."""

from __future__ import annotations

import httpx


WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"


async def fetch_driver_list() -> list[str]:
    """Fetch list of F1 drivers from Wikipedia category (stub for background job)."""
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": "Category:Formula_One_drivers",
        "cmlimit": "50",
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(WIKIPEDIA_API, params=params)
        response.raise_for_status()
        data = response.json()
        members = data.get("query", {}).get("categorymembers", [])
        return [m.get("title", "") for m in members if m.get("title")]
