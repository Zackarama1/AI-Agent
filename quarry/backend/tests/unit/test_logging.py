from __future__ import annotations

import json

import pytest
import structlog

from quarry.core.logging import REDACTED, SecretRedactor, configure_logging


def test_known_secret_masked_anywhere() -> None:
    r = SecretRedactor(["sk-live-9999"])
    assert r.redact_text("calling with sk-live-9999 now") == f"calling with {REDACTED} now"


@pytest.mark.parametrize(
    "text",
    [
        "GET https://api.example.com/quote?symbol=AAPL&token=zzz123",
        "GET https://x.test/q?apikey=abc&symbol=VOD",
        "Authorization: Bearer eyJhbGciOi.payload.sig",
    ],
)
def test_inline_credentials_masked(text: str) -> None:
    out = SecretRedactor([]).redact_text(text)
    assert REDACTED in out
    for leaked in ("zzz123", "apikey=abc", "eyJhbGciOi"):
        assert leaked not in out


def test_sensitive_keys_masked_in_event_dict() -> None:
    r = SecretRedactor([])
    ev = r(None, "info", {"event": "x", "api_key": "123456", "headers": {"Authorization": "b"}})
    assert ev["api_key"] == REDACTED
    assert ev["headers"]["Authorization"] == REDACTED


def test_end_to_end_json_log_has_no_secret(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging("INFO", ["supersecretvalue"])
    structlog.get_logger("t").info("fetch", url="https://h/x?symbol=A", note="supersecretvalue")
    line = capsys.readouterr().out.strip().splitlines()[-1]
    payload = json.loads(line)
    assert payload["note"] == REDACTED
    assert "supersecretvalue" not in line
