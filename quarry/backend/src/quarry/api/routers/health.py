"""/health (liveness of dependencies) and /status (per-provider state and budgets)."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Response
from pydantic import BaseModel

from quarry import __version__
from quarry.api.deps import Resources
from quarry.providers.status import WORKER_HEARTBEAT_KEY, ProviderStatus, collect_status
from quarry.storage import cache, db

router = APIRouter(tags=["system"])


class Health(BaseModel):
    status: str  # "ok" | "degraded"
    version: str
    mode: str
    checks: dict[str, bool]
    worker_last_seen: datetime | None


class Status(BaseModel):
    as_of: datetime
    mode: str
    base_currency: str
    providers: list[ProviderStatus]
    features: dict[str, bool]


@router.get("/health", response_model=Health)
async def health(res: Resources, response: Response) -> Health:
    db_ok = await db.ping(res.engine)
    redis_ok = await cache.ping(res.redis)
    beat: str | None = None
    if redis_ok:
        beat = cache.as_str(await res.redis.get(WORKER_HEARTBEAT_KEY))
    checks = {"database": db_ok, "redis": redis_ok, "worker": beat is not None}
    ok = all(checks.values())
    if not ok:
        response.status_code = 503
    return Health(
        status="ok" if ok else "degraded",
        version=__version__,
        mode=res.settings.mode.value,
        checks=checks,
        worker_last_seen=datetime.fromisoformat(beat) if beat else None,
    )


@router.get("/status", response_model=Status)
async def status(res: Resources) -> Status:
    providers = await collect_status(
        res.redis, list(res.providers.providers.values()), res.settings
    )
    return Status(
        as_of=datetime.now(UTC),
        mode=res.settings.mode.value,
        base_currency=res.settings.base_currency,
        providers=providers,
        features=res.features,
    )
