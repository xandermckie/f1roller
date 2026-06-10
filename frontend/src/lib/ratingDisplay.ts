import type { RosterEntity } from "@/types";

const RATING_FLOOR = 0.5;
const RATING_CEILING = 3.0;

export function toDisplayRating(internal: number | undefined): number {
  if (internal === undefined || Number.isNaN(internal)) {
    return 0;
  }
  const clamped = Math.max(RATING_FLOOR, Math.min(RATING_CEILING, internal));
  const normalized = (clamped - RATING_FLOOR) / (RATING_CEILING - RATING_FLOOR);
  return Math.round(normalized * 100);
}

export function teamAverageRating(entities: RosterEntity[]): number | null {
  const rated = entities
    .map((entity) => entity.computed_rating)
    .filter((rating): rating is number => rating !== undefined);
  if (rated.length === 0) {
    return null;
  }
  const avgInternal = rated.reduce((sum, rating) => sum + rating, 0) / rated.length;
  return toDisplayRating(avgInternal);
}
