import type {
  BenchmarkResponse,
  CalendarEvent,
  DrawResponse,
  GameMode,
  RosterResponse,
  RolledEntity,
  RoundSimResult,
  SimInitializeResponse,
  SimResult,
  SlotId,
  TeamPayload,
} from "@/types";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

interface ValidationDetail {
  msg?: string;
  loc?: unknown[];
}

function formatApiError(status: number, text: string): string {
  if (status === 405) {
    return "Method not allowed — is the backend running on port 8000 and is VITE_API_URL set to /api?";
  }

  if (!text) {
    if (status === 503) {
      return "Database schema outdated. Restart the backend or delete backend/f1roller.db and re-seed.";
    }
    if (status === 502 || status === 500) {
      return "Server error loading roster. Restart the backend with: cd backend && uvicorn app.main:app --reload --port 8000";
    }
    return `API error ${status}`;
  }

  try {
    const parsed = JSON.parse(text) as { detail?: string | ValidationDetail[] };
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((item) => item.msg ?? JSON.stringify(item))
        .join("; ");
    }
  } catch {
    // Non-JSON error bodies fall through.
  }

  return text;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
  } catch {
    throw new Error(
      "Cannot reach the API. Start the backend with: cd backend && uvicorn app.main:app --reload --port 8000",
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatApiError(response.status, text));
  }
  return response.json() as Promise<T>;
}

export interface PoolInfo {
  slot_id: string;
  count: number;
  label: string;
  sample_names: string[];
}

export interface SourceMeta {
  name: string;
  url: string;
  description: string;
}

export function getPool(slotId: SlotId): Promise<PoolInfo> {
  return request(`/pools/${slotId}`);
}

export function roll(slotId: SlotId, excludedIds: string[], sessionSeed: string): Promise<RolledEntity> {
  return request("/roll", {
    method: "POST",
    body: JSON.stringify({ slot_id: slotId, excluded_ids: excludedIds, session_seed: sessionSeed }),
  });
}

export function simulate(team: TeamPayload, sessionSeed: string): Promise<SimResult> {
  return request("/simulate", {
    method: "POST",
    body: JSON.stringify({ team, session_seed: sessionSeed }),
  });
}

export function simulateCompare(
  userTeam: TeamPayload,
  sessionSeed: string,
): Promise<{ user: SimResult; real_grid: SimResult | null }> {
  return request("/simulate/compare", {
    method: "POST",
    body: JSON.stringify({ user_team: userTeam, session_seed: sessionSeed, include_real_grid: true }),
  });
}

export function getCalendar(year = 2026): Promise<CalendarEvent[]> {
  return request(`/calendar?year=${year}`);
}

export function getBenchmark(): Promise<BenchmarkResponse> {
  return request("/benchmark");
}

export function getSources(): Promise<SourceMeta[]> {
  return request("/sources");
}

export interface HealthResponse {
  status: string;
  db: string;
}

export function getHealth(): Promise<HealthResponse> {
  return request("/health");
}

export interface RolledTeamResponse {
  slug: string;
  display_name: string;
}

export interface RolledDecadeResponse {
  decade: string;
}

export function rollTeam(
  sessionSeed: string,
  options?: { excludedTeamSlugs?: string[]; rerollSalt?: string },
): Promise<RolledTeamResponse> {
  return request("/roster/roll-team", {
    method: "POST",
    body: JSON.stringify({
      session_seed: sessionSeed,
      excluded_team_slugs: options?.excludedTeamSlugs ?? [],
      reroll_salt: options?.rerollSalt ?? null,
    }),
  });
}

export function rollDecade(
  sessionSeed: string,
  teamSlug: string,
  rerollSalt?: string,
): Promise<RolledDecadeResponse> {
  return request("/roster/roll-decade", {
    method: "POST",
    body: JSON.stringify({
      session_seed: sessionSeed,
      team_slug: teamSlug,
      reroll_salt: rerollSalt ?? null,
    }),
  });
}

export function fetchRoster(teamSlug: string, decade: string): Promise<RosterResponse> {
  const params = new URLSearchParams({ team_slug: teamSlug, decade });
  return request(`/roster?${params.toString()}`);
}

export function drawTeam(
  sessionSeed: string,
  gameMode: GameMode,
  emptySlots: SlotId[],
  roundIndex: number,
  options?: { excludedTeamSlugs?: string[]; rerollSalt?: string },
): Promise<DrawResponse> {
  return request("/roster/draw", {
    method: "POST",
    body: JSON.stringify({
      session_seed: sessionSeed,
      game_mode: gameMode,
      empty_slots: emptySlots,
      round_index: roundIndex,
      excluded_team_slugs: options?.excludedTeamSlugs ?? [],
      reroll_salt: options?.rerollSalt ?? null,
    }),
  });
}

export function simulateInitialize(team: TeamPayload): Promise<SimInitializeResponse> {
  return request("/simulate/initialize", {
    method: "POST",
    body: JSON.stringify({ team }),
  });
}

export function simulateRound(
  team: TeamPayload,
  sessionSeed: string,
  roundNumber: number,
  gameMode: GameMode,
): Promise<RoundSimResult> {
  return request("/simulate/round", {
    method: "POST",
    body: JSON.stringify({
      team,
      session_seed: sessionSeed,
      round_number: roundNumber,
      game_mode: gameMode,
    }),
  });
}

export interface EntityDetail {
  id: string;
  slug: string;
  display_name: string;
  entity_type: string;
  computed_rating: number;
  era_factor: number;
  stats_json: Record<string, number>;
  rating_breakdown: Record<string, number>;
}

export function getEntityDetail(entityId: string): Promise<EntityDetail> {
  return request(`/entities/${entityId}`);
}
