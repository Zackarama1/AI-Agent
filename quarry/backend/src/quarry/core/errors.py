"""Typed errors that map to user-facing panels via the API's error handler."""

from __future__ import annotations


class QuarryError(Exception):
    status_code = 500
    code = "internal_error"

    def __init__(self, message: str, *, detail: dict[str, object] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail or {}


class NotFoundError(QuarryError):
    status_code = 404
    code = "not_found"


class ConfigError(QuarryError):
    code = "config_error"


class RateLimitedError(QuarryError):
    status_code = 429
    code = "rate_limited"


class ProviderUnavailableError(QuarryError):
    status_code = 503
    code = "provider_unavailable"


class LicenceError(QuarryError):
    status_code = 403
    code = "licence_restricted"
