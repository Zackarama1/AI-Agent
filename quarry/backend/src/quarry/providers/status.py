"""Live provider connection status, shared via Redis (written by worker, read by /status)."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, cast

from pydantic import BaseModel
from redis.asyncio import Redis

from quarry.core.settings import Settings
from quarry.providers.base import CapabilityManifest
from quarry.providers.ratelimit import RateLimiter
from quarry.storage.cache import as_str

WORKER_HEARTBEAT_KEY = "worker:heartbeat"
WORKER_HEARTBEAT_TTL_S = 15


class ProviderState(StrEnum):
    CONNECTED = "connected"  # stream up / last call ok
    IDLE = "idle"  # configured, nothing requested yet
    DEGRADED = "degraded"  # errors or rate-limited, falling back
    ERROR = "error"
    UNCONFIGURED = "unconfigured"  # missing API key
    DISABLED = "disabled"  # off in providers.yaml / feature flag


class ProviderStatus(BaseModel):
    id: str
    display_name: str
    state: ProviderState
    cost_tier: str
    latency_class: str
    last_message_at: datetime | None = None
    last_error: str | None = None
    used_today: int = 0
    daily_limit: int | None = None
    budget_warning: bool = False
    ws_symbol_cap: int | None = None
    attribution_text: str | None = None


def _key(provider_id: str) -> str:
    return f"provider:status:{provider_id}"


async def record_status(
    redis: Redis, provider_id: str, state: ProviderState, error: str | None = None
) -> None:
    now = datetime.now(UTC).isoformat()
    mapping = {"state": state.value, "updated_at": now}
    if state is ProviderState.CONNECTED:
        mapping["last_message_at"] = now
    if error is not None:
        mapping["last_error"] = error[:500]
    await redis.hset(_key(provider_id), mapping=cast("Mapping[Any, Any]", mapping))


async def collect_status(
    redis: Redis, manifests: list[CapabilityManifest], settings: Settings
) -> list[ProviderStatus]:
    limiter = RateLimiter(redis)
    out: list[ProviderStatus] = []
    for m in manifests:
        raw = {
            as_str(k) or "": as_str(v) or "" for k, v in (await redis.hgetall(_key(m.id))).items()
        }
        if not m.enabled:
            state = ProviderState.DISABLED
        elif not all(settings.key_configured(f) for f in m.key_fields):
            state = ProviderState.UNCONFIGURED
        else:
            state = ProviderState(raw.get("state", ProviderState.IDLE.value))
        budget = await limiter.budget(m)
        last = raw.get("last_message_at")
        out.append(
            ProviderStatus(
                id=m.id,
                display_name=m.display_name,
                state=state,
                cost_tier=m.cost_tier.value,
                latency_class=m.latency_class.value,
                last_message_at=datetime.fromisoformat(last) if last else None,
                last_error=raw.get("last_error"),
                used_today=budget.used_today,
                daily_limit=budget.daily_limit,
                budget_warning=budget.warning,
                ws_symbol_cap=m.ws_symbol_cap,
                attribution_text=m.licence.attribution_text,
            )
        )
    return out
