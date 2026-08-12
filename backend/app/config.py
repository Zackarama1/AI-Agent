"""Runtime configuration, loaded from environment / .env.

Every external key is optional. When a key is missing the corresponding
client falls back to deterministic mock data so the whole app runs offline.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    finnhub_api_key: str = ""
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5"

    # Where the SQLite portfolio lives (relative to backend/).
    db_path: str = "stocksense.db"

    @property
    def has_finnhub(self) -> bool:
        return bool(self.finnhub_api_key)

    @property
    def has_anthropic(self) -> bool:
        return bool(self.anthropic_api_key)


settings = Settings()
