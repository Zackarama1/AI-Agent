from __future__ import annotations

from quarry.core.settings import Mode
from tests.conftest import FAKE_KEY, make_settings


def test_defaults_are_safe() -> None:
    s = make_settings()
    assert s.mode is Mode.PERSONAL
    assert s.api_host == "127.0.0.1"
    assert s.base_currency == "GBP"


def test_secrets_are_hidden_and_collected() -> None:
    s = make_settings(finnhub_api_key=FAKE_KEY, fred_api_key="")
    assert FAKE_KEY not in repr(s)
    assert s.secret_values() == [FAKE_KEY]
    assert s.key_configured("finnhub_api_key")
    assert not s.key_configured("fred_api_key")
    assert not s.key_configured("alpaca_api_key_id")


def test_cors_origins_accepts_comma_list() -> None:
    s = make_settings(cors_origins="http://a.test, http://b.test")
    assert s.cors_origins == ["http://a.test", "http://b.test"]
