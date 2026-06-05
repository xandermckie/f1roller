export type SlotId =
  | "driver_1"
  | "driver_2"
  | "reserve_driver"
  | "constructor"
  | "engine"
  | "team_principal"
  | "technical_director"
  | "lead_engineer"
  | "title_sponsor"
  | "secondary_sponsor"
  | "livery_style"
  | "team_motto";

export type SessionPhase = "rolling" | "assigning" | "simulating" | "complete";

export interface RolledEntity {
  id: string;
  slug: string;
  display_name: string;
  entity_type: string;
  nationality?: string;
  peak_year?: number;
  stats_summary?: string;
  computed_rating?: number;
  portrait_path?: string;
  accent_color?: string;
}

export interface TeamPayload {
  driver_1_id: string;
  driver_2_id: string;
  reserve_driver_id: string;
  constructor_id: string;
  engine_id: string;
  team_principal_id: string;
  technical_director_id: string;
  lead_engineer_id: string;
  title_sponsor_id: string;
  secondary_sponsor_id: string;
  livery_style: string;
  team_motto: string;
}

export interface RollSession {
  sessionId: string;
  startedAt: string;
  rolls: Partial<Record<SlotId, RolledEntity>>;
  currentSlotIndex: number;
  driverOrderSwapped: boolean;
  phase: SessionPhase;
  sessionSeed: string;
  sessionVersion?: number;
  teamPayload?: TeamPayload;
  simResult?: SimResult;
}

export interface RacePosition {
  position: number;
  driver_name: string;
  team_name: string;
  points: number;
  is_user_team: boolean;
  is_user_driver: boolean;
}

export interface RaceResult {
  round: number;
  meeting_key: number;
  meeting_name: string;
  circuit_short_name: string | null;
  circuit_key: number | null;
  positions: RacePosition[];
  user_race_points: number;
  user_wdc_points_after: number;
  user_wcc_points_after: number;
}

export interface ChampionshipEntry {
  name: string;
  points: number;
  is_user: boolean;
  team_name?: string;
}

export interface UserSummary {
  wdc_position: number;
  wcc_position: number;
  wins: number;
  poles: number;
  team_efficiency_pct?: number;
}

export interface SimResult {
  races: RaceResult[];
  final_wdc: ChampionshipEntry[];
  final_wcc: ChampionshipEntry[];
  user_summary: UserSummary;
  session_seed: string;
}

export interface CalendarEvent {
  meeting_key: number;
  year: number;
  round_number: number;
  meeting_name: string;
  circuit_key: number | null;
  circuit_short_name: string | null;
  country_name: string | null;
  date_start: string | null;
  is_cancelled: boolean;
  circuit_map_path: string | null;
  openf1_circuit_image_url: string | null;
}

export interface BenchmarkResponse {
  team: TeamPayload;
  projected_wdc_points: number;
  projected_wcc_points: number;
  team_pace: number;
  computed_at: string | null;
}

export const SLOT_ORDER: SlotId[] = [
  "driver_1",
  "driver_2",
  "reserve_driver",
  "constructor",
  "engine",
  "team_principal",
  "technical_director",
  "lead_engineer",
  "title_sponsor",
  "secondary_sponsor",
  "livery_style",
  "team_motto",
];

export const SLOT_LABELS: Record<SlotId, string> = {
  driver_1: "Driver 1",
  driver_2: "Driver 2",
  reserve_driver: "Reserve Driver",
  constructor: "Constructor",
  engine: "Engine Supplier",
  team_principal: "Team Principal",
  technical_director: "Technical Director",
  lead_engineer: "Lead Engineer",
  title_sponsor: "Title Sponsor",
  secondary_sponsor: "Secondary Sponsor",
  livery_style: "Livery Style",
  team_motto: "Team Motto",
};

export const STAT_SLOTS: SlotId[] = [
  "driver_1",
  "driver_2",
  "reserve_driver",
  "constructor",
  "engine",
  "team_principal",
  "technical_director",
  "lead_engineer",
];
