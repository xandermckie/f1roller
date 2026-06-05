from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./f1roller.db"
    openf1_base_url: str = "https://api.openf1.org/v1"
    scrape_delay_ms: int = 1500
    cache_ttl_days: int = 7
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    sim_season_year: int = 2026
    user_agent: str = (
        "F1RollerFanBot/1.0 (non-commercial; contact: github.com/xandermckie)"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
