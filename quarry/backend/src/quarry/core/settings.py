"""Typed application settings, loaded from environment variables and `.env`.

Secrets are `SecretStr` so they never print by accident; `secret_values()` feeds
the log redactor. Settings are validated once at startup (`get_settings()`).
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_QUARRY_ROOT = Path(__file__).resolve().parents[4]


class Mode(StrEnum):
    PERSONAL = "personal"
    PROFESSIONAL = "professional"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_QUARRY_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mode: Mode = Mode.PERSONAL
    env: str = Field(default="dev", pattern=r"^(dev|test|prod)$")
    log_level: str = "INFO"
    base_currency: str = Field(default="GBP", pattern=r"^[A-Z]{3}$")

    # Bind to localhost by default. Remote access (iPad) goes through Tailscale or
    # an HTTPS reverse proxy; see docs/DEPLOY.md.
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    database_url: str = "postgresql+asyncpg://quarry:quarry@localhost:5432/quarry"
    redis_url: str = "redis://localhost:6379/0"

    config_dir: Path = _QUARRY_ROOT / "config"
    static_dir: Path | None = None  # built SPA, served by the API in prod

    # Contact for the SEC EDGAR User-Agent (required by SEC fair-access rules; P3).
    sec_user_agent: str = "QUARRY/0.1 (contact: unset@example.com)"

    # Provider keys. All optional: an adapter without its key reports "unconfigured".
    finnhub_api_key: SecretStr | None = None
    alpaca_api_key_id: SecretStr | None = None
    alpaca_api_secret_key: SecretStr | None = None
    twelvedata_api_key: SecretStr | None = None
    fmp_api_key: SecretStr | None = None
    eodhd_api_key: SecretStr | None = None
    fred_api_key: SecretStr | None = None
    companies_house_api_key: SecretStr | None = None
    coingecko_api_key: SecretStr | None = None
    oanda_api_token: SecretStr | None = None
    marketaux_api_key: SecretStr | None = None
    openfigi_api_key: SecretStr | None = None
    anthropic_api_key: SecretStr | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str) and not v.startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    def secret_values(self) -> list[str]:
        """Every configured secret value, for log redaction."""
        out: list[str] = []
        for name in type(self).model_fields:
            value = getattr(self, name)
            if isinstance(value, SecretStr):
                raw = value.get_secret_value()
                if raw:
                    out.append(raw)
        return out

    def key_configured(self, field: str) -> bool:
        value = getattr(self, field, None)
        return isinstance(value, SecretStr) and bool(value.get_secret_value())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
