import type { RaceResult } from "@/types";

export interface SeasonRow {
  round: number;
  meetingName: string;
  date: string | null;
  userRacePoints: number;
  cumulativeWcc: number;
  wdcLeader: string;
}

export function buildSeasonRows(races: RaceResult[]): SeasonRow[] {
  let cumulative = 0;
  return races.map((race) => {
    cumulative += race.user_race_points;
    const leader = race.positions[0]?.driver_name ?? "—";
    return {
      round: race.round,
      meetingName: race.meeting_name,
      date: null,
      userRacePoints: race.user_race_points,
      cumulativeWcc: cumulative,
      wdcLeader: leader,
    };
  });
}
