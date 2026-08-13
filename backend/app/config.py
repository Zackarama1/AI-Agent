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

    # Market data provider: "yahoo" (free, no key), "finnhub" (needs key),
    # or "mock" (offline). "auto" picks finnhub if a key is set, else yahoo.
    market_provider: str = "auto"

    # Paper-trading starting cash for a new account.
    starting_cash: float = 100_000.0

    # Where the SQLite portfolio lives (relative to backend/).
    db_path: str = "stocksense.db"

    # Auth. Override jwt_secret in production (env: JWT_SECRET).
    jwt_secret: str = "dev-insecure-change-me"
    jwt_expire_days: int = 30

    @property
    def has_finnhub(self) -> bool:
        return bool(self.finnhub_api_key)

    @property
    def has_anthropic(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def provider(self) -> str:
        """Resolve 'auto' to a concrete provider."""
        if self.market_provider != "auto":
            return self.market_provider
        return "finnhub" if self.has_finnhub else "yahoo"


settings = Settings()
