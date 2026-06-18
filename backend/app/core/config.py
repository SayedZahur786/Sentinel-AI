from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Sentinel AI API"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/sentinel"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"
    frontend_origins: str = "http://localhost:5173"
    ai_mock_mode: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
