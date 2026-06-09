from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

SlotId = Literal[
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
]


class HealthResponse(BaseModel):
    status: str
    db: str
    cache_age_hours: float | None = None


class RolledEntity(BaseModel):
    id: str
    slug: str
    display_name: str
    entity_type: str
    nationality: str | None = None
    peak_year: int | None = None
    stats_summary: str | None = None
    computed_rating: float | None = None
    portrait_path: str | None = None
    accent_color: str | None = None


class PoolInfo(BaseModel):
    slot_id: str
    count: int
    label: str
    sample_names: list[str]


class RollRequest(BaseModel):
    slot_id: SlotId
    excluded_ids: list[str] = Field(default_factory=list)
    session_seed: str | None = None


class TeamPayload(BaseModel):
    driver_1_id: str
    driver_2_id: str
    reserve_driver_id: str
    constructor_id: str
    engine_id: str
    team_principal_id: str
    technical_director_id: str
    lead_engineer_id: str
    title_sponsor_id: str
    secondary_sponsor_id: str
    livery_style: str = "classic"
    team_motto: str = "Speed is eternal"


class CalendarEventOut(BaseModel):
    meeting_key: int
    year: int
    round_number: int
    meeting_name: str
    circuit_key: int | None
    circuit_short_name: str | None
    country_name: str | None
    date_start: datetime | None
    is_cancelled: bool
    circuit_map_path: str | None
    openf1_circuit_image_url: str | None


class RacePosition(BaseModel):
    position: int
    driver_name: str
    team_name: str
    points: int
    is_user_team: bool = False
    is_user_driver: bool = False


class RaceResult(BaseModel):
    round: int
    meeting_key: int
    meeting_name: str
    circuit_short_name: str | None
    circuit_key: int | None
    positions: list[RacePosition]
    user_race_points: int
    user_wdc_points_after: int
    user_wcc_points_after: int


class ChampionshipEntry(BaseModel):
    name: str
    points: int
    is_user: bool = False
    team_name: str | None = None


class UserSummary(BaseModel):
    wdc_position: int
    wcc_position: int
    wins: int
    poles: int = 0
    team_efficiency_pct: float | None = None


class SimResult(BaseModel):
    races: list[RaceResult]
    final_wdc: list[ChampionshipEntry]
    final_wcc: list[ChampionshipEntry]
    user_summary: UserSummary
    session_seed: str


class SimulateRequest(BaseModel):
    team: TeamPayload
    session_seed: str


class CompareRequest(BaseModel):
    user_team: TeamPayload
    session_seed: str
    include_real_grid: bool = True


class CompareResponse(BaseModel):
    user: SimResult
    real_grid: SimResult | None = None


class BenchmarkResponse(BaseModel):
    team: TeamPayload
    projected_wdc_points: float
    projected_wcc_points: float
    team_pace: float
    computed_at: datetime | None


class RealGridEntryOut(BaseModel):
    team_name: str
    driver_number: int | None
    driver_name: str
    constructor_name: str


class SourceMeta(BaseModel):
    name: str
    url: str
    description: str


class EntityDetail(BaseModel):
    id: str
    slug: str
    display_name: str
    entity_type: str
    computed_rating: float
    era_factor: float
    stats_json: dict
    rating_breakdown: dict


class RosterEntity(RolledEntity):
    assignable_slots: list[str]
    role_label: str | None = None


class RosterResponse(BaseModel):
    team_slug: str
    team_display_name: str
    decade: str
    entities: list[RosterEntity]
    pool_warnings: list[str] = Field(default_factory=list)


class RolledTeamResponse(BaseModel):
    slug: str
    display_name: str


class RolledDecadeResponse(BaseModel):
    decade: str


class RollTeamRequest(BaseModel):
    session_seed: str
    excluded_team_slugs: list[str] = Field(default_factory=list)
    reroll_salt: str | None = None


class RollDecadeRequest(BaseModel):
    session_seed: str
    reroll_salt: str | None = None
