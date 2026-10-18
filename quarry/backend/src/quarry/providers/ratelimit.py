"""Shared per-provider rate limiting and daily budget accounting in Redis/Valkey.

The api and worker processes share one budget per provider because the bucket
lives in Redis. Each `RateWindow` from the manifest becomes a token bucket; a
request is allowed only if every window has a token. Time comes from the Redis
server (`TIME`) so processes with skewed clocks agree.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime

from redis.asyncio import Redis

from quarry.core.errors import RateLimitedError
from quarry.providers.base import CapabilityManifest, RateWindow

# KEYS: one bucket hash per window. ARGV: cost, then (capacity, refill_per_ms) pairs.
# Returns {allowed (0/1), wait_ms}. Either all buckets are charged or none.
_BUCKET_LUA = """
local cost = tonumber(ARGV[1])
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local wait = 0
local state = {}
for i, key in ipairs(KEYS) do
  local capacity = tonumber(ARGV[2 + (i - 1) * 2])
  local rate = tonumber(ARGV[3 + (i - 1) * 2])
  local h = redis.call('HMGET', key, 'tokens', 'ts')
  local tokens = tonumber(h[1]) or capacity
  local ts = tonumber(h[2]) or now
  tokens = math.min(capacity, tokens + (now - ts) * rate)
  state[i] = tokens
  if tokens < cost then
    local need = math.ceil((cost - tokens) / rate)
    if need > wait then wait = need end
  end
end
if wait > 0 then return {0, wait} end
for i, key in ipairs(KEYS) do
  local capacity = tonumber(ARGV[2 + (i - 1) * 2])
  local rate = tonumber(ARGV[3 + (i - 1) * 2])
  redis.call('HSET', key, 'tokens', state[i] - cost, 'ts', now)
  redis.call('PEXPIRE', key, math.ceil(capacity / rate) + 1000)
end
return {1, 0}
"""


@dataclass(frozen=True)
class Acquire:
    allowed: bool
    wait_ms: int


@dataclass(frozen=True)
class Budget:
    used_today: int
    daily_limit: int | None

    @property
    def fraction(self) -> float | None:
        if not self.daily_limit:
            return None
        return self.used_today / self.daily_limit

    @property
    def warning(self) -> bool:
        f = self.fraction
        return f is not None and f >= 0.8


def _bucket_key(provider_id: str, w: RateWindow) -> str:
    return f"rl:{provider_id}:{w.requests}/{w.seconds}s"


def _budget_key(provider_id: str, day: str) -> str:
    return f"budget:{provider_id}:{day}"


def _today() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


class RateLimiter:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis
        self._script = redis.register_script(_BUCKET_LUA)

    async def try_acquire(self, manifest: CapabilityManifest, cost: int = 1) -> Acquire:
        windows = manifest.rate_limits
        if not windows:
            await self._count(manifest.id, cost)
            return Acquire(True, 0)
        keys = [_bucket_key(manifest.id, w) for w in windows]
        args: list[float | int] = [cost]
        for w in windows:
            args += [w.requests, w.requests / (w.seconds * 1000)]
        allowed, wait_ms = await self._script(keys=keys, args=args)
        if int(allowed):
            await self._count(manifest.id, cost)
        return Acquire(bool(int(allowed)), int(wait_ms))

    async def acquire(
        self, manifest: CapabilityManifest, cost: int = 1, max_wait_s: float = 5.0
    ) -> None:
        """Wait for a token up to `max_wait_s`, else raise RateLimitedError."""
        loop = asyncio.get_running_loop()
        deadline = loop.time() + max_wait_s
        while True:
            res = await self.try_acquire(manifest, cost)
            if res.allowed:
                return
            remaining = deadline - loop.time()
            if res.wait_ms / 1000 > remaining:
                raise RateLimitedError(
                    f"{manifest.display_name} rate limit reached",
                    detail={"provider": manifest.id, "retry_after_ms": res.wait_ms},
                )
            await asyncio.sleep(res.wait_ms / 1000)

    async def _count(self, provider_id: str, cost: int) -> None:
        key = _budget_key(provider_id, _today())
        pipe = self._redis.pipeline()
        pipe.incrby(key, cost)
        pipe.expire(key, 3 * 86_400)
        await pipe.execute()

    async def budget(self, manifest: CapabilityManifest) -> Budget:
        raw = await self._redis.get(_budget_key(manifest.id, _today()))
        return Budget(used_today=int(raw or 0), daily_limit=manifest.daily_limit)
