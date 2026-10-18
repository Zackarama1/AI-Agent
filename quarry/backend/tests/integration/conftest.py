from __future__ import annotations

import asyncio
import subprocess
import sys
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from redis.asyncio import Redis
from sqlalchemy import text

from quarry.api.app import create_app
from quarry.core.settings import Settings
from quarry.storage.cache import make_redis
from quarry.storage.db import make_engine
from tests.conftest import FAKE_KEY, TEST_DATABASE_URL, TEST_REDIS_URL, make_settings

BACKEND = Path(__file__).resolve().parents[2]

pytestmark = pytest.mark.integration


async def _reachable() -> bool:
    engine = make_engine(TEST_DATABASE_URL)
    redis = make_redis(TEST_REDIS_URL)
    try:
        async with engine.connect() as c:
            await c.execute(text("SELECT 1"))
        await redis.ping()
    except Exception:
        return False
    finally:
        await engine.dispose()
        await redis.aclose()
    return True


@pytest.fixture(scope="session")
async def migrated() -> None:
    if not await _reachable():
        pytest.skip("integration services unavailable (TEST_DATABASE_URL / TEST_REDIS_URL)")
    env = {"DATABASE_URL": TEST_DATABASE_URL, "PATH": "", "PYTHONPATH": str(BACKEND / "src")}
    for cmd in (["downgrade", "base"], ["upgrade", "head"]):
        await asyncio.to_thread(
            subprocess.run,
            [sys.executable, "-m", "alembic", *cmd],
            cwd=BACKEND,
            env=env,
            check=True,
        )


@pytest.fixture
async def redis(migrated: None) -> AsyncIterator[Redis]:
    r = make_redis(TEST_REDIS_URL)
    await r.flushdb()
    yield r
    await r.flushdb()
    await r.aclose()


@pytest.fixture
async def clean_db(migrated: None) -> None:
    engine = make_engine(TEST_DATABASE_URL)
    async with engine.begin() as c:
        await c.execute(
            text(
                "TRUNCATE workspace_layout, command_history, instrument_alias, instrument, exchange"
            )
        )
    await engine.dispose()


@pytest.fixture
def app_settings() -> Settings:
    return make_settings(alpaca_api_key_id=None, finnhub_api_key=FAKE_KEY)


@pytest.fixture
async def client(
    app_settings: Settings, redis: Redis, clean_db: None
) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app(app_settings)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
