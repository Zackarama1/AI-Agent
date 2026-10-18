from __future__ import annotations

from pathlib import Path

import pytest

from quarry.core.errors import ConfigError
from quarry.providers.config import (
    FunctionsConfig,
    ProvidersConfig,
    load_features,
    load_functions,
    load_providers,
)
from tests.conftest import CONFIG_DIR, FAKE_KEY, make_settings


def test_shipped_configs_validate() -> None:
    providers = load_providers(CONFIG_DIR)
    functions = load_functions(CONFIG_DIR)
    features = load_features(CONFIG_DIR)
    assert "finnhub" in providers.providers
    assert {f.code for f in functions.functions} >= {"DES", "GP", "WL", "HELP", "STAT"}
    assert features["pwa"] is True


def test_paid_providers_ship_disabled() -> None:
    providers = load_providers(CONFIG_DIR)
    for m in providers.providers.values():
        if m.cost_tier == "paid":
            assert not m.enabled, f"{m.id} is paid and must be opt-in"


def test_route_skips_unconfigured_providers() -> None:
    providers = load_providers(CONFIG_DIR)
    none_set = make_settings()
    assert [m.id for m in providers.route("quotes.us_equity", none_set)] == []
    only_finnhub = make_settings(finnhub_api_key=FAKE_KEY)
    assert [m.id for m in providers.route("quotes.us_equity", only_finnhub)] == ["finnhub"]


def test_unknown_provider_in_route_rejected() -> None:
    with pytest.raises(ValueError, match="unknown providers"):
        ProvidersConfig.model_validate({"providers": {}, "routing": {"x": ["nope"]}})


def test_duplicate_function_codes_rejected() -> None:
    fn = {"code": "GP", "title": "t", "phase": 1, "group": "g", "summary": "s"}
    with pytest.raises(ValueError, match="duplicate"):
        FunctionsConfig.model_validate(
            {"functions": [fn, fn], "market_suffixes": {}, "sector_suffixes": {}}
        )


def test_missing_config_is_a_config_error(tmp_path: Path) -> None:
    with pytest.raises(ConfigError):
        load_providers(tmp_path)


def test_daily_limit_derived() -> None:
    providers = load_providers(CONFIG_DIR)
    assert providers.providers["twelvedata"].daily_limit == 800
    assert providers.providers["finnhub"].daily_limit is None
