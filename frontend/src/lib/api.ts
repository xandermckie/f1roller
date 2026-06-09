import type {
  BenchmarkResponse,
  CalendarEvent,
  RolledEntity,
  SimResult,
  SlotId,
  TeamPayload,
} from "@/types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

interface ValidationDetail {
  msg?: string;
  loc?: unknown[];
}

function formatApiError(status: number, text: string): string {
  if (!text) {
    if (status === 502 || status === 503 || status === 500) {
      return "Cannot reach the API. Start the backend with: cd backend && uvicorn app.main:app --reload --port 8000";
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
