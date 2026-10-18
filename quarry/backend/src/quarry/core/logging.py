"""structlog JSON logging with secret redaction.

Two layers: exact configured secret values are masked wherever they appear, and
common credential-looking key/value pairs (apikey=..., token=..., Authorization
headers) are masked even if the value is not a known secret.
"""

from __future__ import annotations

import logging
import re
import sys
from collections.abc import Iterable, MutableMapping
from typing import Any

import structlog

REDACTED = "***REDACTED***"

_SENSITIVE_KEYS = re.compile(
    r"(api[_-]?key|apikey|token|secret|password|authorization|apca-api-key-id|apca-api-secret-key)",
    re.IGNORECASE,
)
_INLINE_PATTERN = re.compile(
    r"(?i)((?:api[_-]?key|apikey|token|secret|password)=)([^&\s\"']+)"
    r"|(bearer\s+)([A-Za-z0-9._\-]+)"
)


class SecretRedactor:
    def __init__(self, secrets: Iterable[str]) -> None:
        # Longest first so overlapping secrets are fully masked.
        self._secrets = sorted({s for s in secrets if len(s) >= 4}, key=len, reverse=True)

    def redact_text(self, text: str) -> str:
        for s in self._secrets:
            text = text.replace(s, REDACTED)

        def _mask(m: re.Match[str]) -> str:
            prefix = m.group(1) or m.group(3)
            return f"{prefix}{REDACTED}"

        return _INLINE_PATTERN.sub(_mask, text)

    def _redact(self, value: Any, key: str | None = None) -> Any:
        if key is not None and _SENSITIVE_KEYS.search(key) and value not in (None, ""):
            return REDACTED
        if isinstance(value, str):
            return self.redact_text(value)
        if isinstance(value, dict):
            return {k: self._redact(v, str(k)) for k, v in value.items()}
        if isinstance(value, list | tuple):
            return type(value)(self._redact(v) for v in value)
        return value

    def __call__(
        self, _logger: Any, _method: str, event_dict: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]:
        for k in list(event_dict.keys()):
            event_dict[k] = self._redact(event_dict[k], k if k != "event" else None)
        return event_dict


def configure_logging(level: str = "INFO", secrets: Iterable[str] = ()) -> None:
    redactor = SecretRedactor(secrets)
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level.upper(), force=True)
    # Per-run job chatter from the scheduler is noise at INFO.
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.format_exc_info,
            redactor,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(level.upper())),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=False,
    )
