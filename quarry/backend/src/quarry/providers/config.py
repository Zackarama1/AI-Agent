"""Load and validate config/providers.yaml, features.yaml and functions.yaml."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from quarry.core.errors import ConfigError
from quarry.core.settings import Settings
from quarry.providers.base import CapabilityManifest


class ProvidersConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    providers: dict[str, CapabilityManifest]
    # Capability route -> provider ids in priority order, e.g. "quotes.us_equity".
    routing: dict[str, tuple[str, ...]] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _inject_ids(cls, data: Any) -> Any:
        if isinstance(data, dict) and isinstance(data.get("providers"), dict):
            for pid, body in data["providers"].items():
                if isinstance(body, dict):
                    body.setdefault("id", pid)
        return data

    @model_validator(mode="after")
    def _routes_reference_known_providers(self) -> ProvidersConfig:
        for route, ids in self.routing.items():
            unknown = [i for i in ids if i not in self.providers]
            if unknown:
                raise ValueError(f"route {route!r} references unknown providers {unknown}")
        for pid, m in self.providers.items():
            if m.id != pid:
                raise ValueError(f"provider key {pid!r} does not match id {m.id!r}")
        return self

    def route(self, capability: str, settings: Settings) -> list[CapabilityManifest]:
        """Enabled, configured providers for a capability, in priority order."""
        out = []
        for pid in self.routing.get(capability, ()):
            m = self.providers[pid]
            if m.enabled and all(settings.key_configured(f) for f in m.key_fields):
                out.append(m)
        return out


class FunctionSpec(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    code: str = Field(pattern=r"^[A-Z][A-Z0-9]{1,5}$")
    title: str
    phase: int = Field(ge=0, le=8)
    group: str
    needs_security: bool = False
    args: tuple[str, ...] = ()
    summary: str
    available: bool = False


class FunctionsConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    functions: tuple[FunctionSpec, ...]
    market_suffixes: dict[str, str]
    sector_suffixes: dict[str, str]

    @model_validator(mode="after")
    def _unique_codes(self) -> FunctionsConfig:
        codes = [f.code for f in self.functions]
        dupes = {c for c in codes if codes.count(c) > 1}
        if dupes:
            raise ValueError(f"duplicate function codes: {sorted(dupes)}")
        return self


def _load_yaml(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as fh:
            return yaml.safe_load(fh)
    except FileNotFoundError as exc:
        raise ConfigError(f"missing config file: {path}") from exc
    except yaml.YAMLError as exc:
        raise ConfigError(f"invalid YAML in {path}: {exc}") from exc


def load_providers(config_dir: Path) -> ProvidersConfig:
    try:
        return ProvidersConfig.model_validate(_load_yaml(config_dir / "providers.yaml"))
    except ValidationError as exc:
        raise ConfigError(f"providers.yaml failed validation: {exc}") from exc


def load_functions(config_dir: Path) -> FunctionsConfig:
    try:
        return FunctionsConfig.model_validate(_load_yaml(config_dir / "functions.yaml"))
    except ValidationError as exc:
        raise ConfigError(f"functions.yaml failed validation: {exc}") from exc


def load_features(config_dir: Path) -> dict[str, bool]:
    data = _load_yaml(config_dir / "features.yaml") or {}
    flags = data.get("features", {})
    if not isinstance(flags, dict) or not all(isinstance(v, bool) for v in flags.values()):
        raise ConfigError("features.yaml: 'features' must map flag names to booleans")
    return {str(k): bool(v) for k, v in flags.items()}


@lru_cache(maxsize=4)
def cached_providers(config_dir: Path) -> ProvidersConfig:
    return load_providers(config_dir)


@lru_cache(maxsize=4)
def cached_functions(config_dir: Path) -> FunctionsConfig:
    return load_functions(config_dir)
