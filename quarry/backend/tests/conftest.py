"""Shared fixtures. Integration tests need PostgreSQL + Redis/Valkey; they are skipped
(not failed) when TEST_DATABASE_URL / TEST_REDIS_URL are unreachable, and CI provides both."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from quarry.core.settings import Settings

QUARRY_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = QUARRY_ROOT / "config"

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://quarry:quarry@localhost:5432/quarry_test"
)
TEST_REDIS_URL = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15")

# Obviously fake credential for tests, assembled at runtime so secret scanners
# (gitleaks in CI) don't mistake it for a committed key.
FAKE_KEY = "-".join(["fake", "test", "value", "0000"])


def make_settings(**overrides: object) -> Settings:
    base: dict[str, object] = {
        "env": "test",
        "database_url": TEST_DATABASE_URL,
        "redis_url": TEST_REDIS_URL,
        "config_dir": CONFIG_DIR,
        "_env_file": None,
    }
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


@pytest.fixture
def settings() -> Settings:
    return make_settings()
