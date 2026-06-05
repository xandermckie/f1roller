import { describe, expect, it } from "vitest";

import { buildSeasonRows } from "@/lib/pointsTable";
import type { RaceResult } from "@/types";

describe("pointsTable", () => {
  it("accumulates WCC points", () => {
    const races: RaceResult[] = [
      {
        round: 1,
        meeting_key: 1,
        meeting_name: "Bahrain GP",
        circuit_short_name: "Sakhir",
        circuit_key: 63,
        positions: [],
        user_race_points: 12,
        user_wdc_points_after: 6,
        user_wcc_points_after: 12,
      },
      {
        round: 2,
        meeting_key: 2,
        meeting_name: "Saudi GP",
        circuit_short_name: "Jeddah",
        circuit_key: 149,
        positions: [],
        user_race_points: 8,
        user_wdc_points_after: 10,
        user_wcc_points_after: 20,
      },
    ];
    const rows = buildSeasonRows(races);
    expect(rows[0]?.cumulativeWcc).toBe(12);
    expect(rows[1]?.cumulativeWcc).toBe(20);
  });
});
