"""`quarry-worker` entrypoint: scheduler + (from Phase 1) stream ingestion.

Phase 0 runs the heartbeat that /health checks, and seeds provider status.
"""

from __future__ import annotations

import asyncio
import signal
from datetime import UTC, datetime

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from redis.asyncio import Redis

from quarry.core.logging import configure_logging
from quarry.core.settings import Settings, get_settings
from quarry.providers.config import load_providers
from quarry.providers.status import (
    WORKER_HEARTBEAT_KEY,
    WORKER_HEARTBEAT_TTL_S,
    ProviderState,
    record_status,
)
from quarry.storage.cache import make_redis

log = structlog.get_logger("quarry.worker")


async def heartbeat(redis: Redis) -> None:
    await redis.set(WORKER_HEARTBEAT_KEY, datetime.now(UTC).isoformat(), ex=WORKER_HEARTBEAT_TTL_S)


async def seed_provider_status(redis: Redis, settings: Settings) -> None:
    cfg = load_providers(settings.config_dir)
    for m in cfg.providers.values():
        if m.enabled and all(settings.key_configured(f) for f in m.key_fields):
            await record_status(redis, m.id, ProviderState.IDLE)


async def run(settings: Settings) -> None:
    redis = make_redis(settings.redis_url)
    await seed_provider_status(redis, settings)
    await heartbeat(redis)

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(heartbeat, "interval", seconds=5, args=[redis], id="heartbeat")
    scheduler.start()
    log.info("worker.start")

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    await stop.wait()

    scheduler.shutdown(wait=False)
    await redis.delete(WORKER_HEARTBEAT_KEY)
    await redis.aclose()
    log.info("worker.stop")


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level, settings.secret_values())
    asyncio.run(run(settings))


if __name__ == "__main__":
    main()
