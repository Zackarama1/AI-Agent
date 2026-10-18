from __future__ import annotations

import pytest
from redis.asyncio import Redis

from quarry.core.errors import RateLimitedError
from quarry.core.provenance import LatencyClass, LicenceFlags
from quarry.providers.base import AssetClass, CapabilityManifest, RateWindow
from quarry.providers.ratelimit import RateLimiter
from quarry.storage.cache import as_str

pytestmark = pytest.mark.integration


def manifest(*windows: RateWindow) -> CapabilityManifest:
    return CapabilityManifest(
        id="testprov",
        display_name="Test",
        asset_classes=(AssetClass.EQUITY,),
        latency_class=LatencyClass.EOD,
        rate_limits=windows,
        licence=LicenceFlags(),
    )


async def test_bucket_allows_capacity_then_denies(redis: Redis) -> None:
    m = manifest(RateWindow(requests=3, seconds=60))
    rl = RateLimiter(redis)
    results = [await rl.try_acquire(m) for _ in range(4)]
    assert [r.allowed for r in results] == [True, True, True, False]
    assert results[-1].wait_ms > 0


async def test_all_windows_must_pass_and_none_charged_on_deny(redis: Redis) -> None:
    m = manifest(RateWindow(requests=10, seconds=60), RateWindow(requests=2, seconds=86400))
    rl = RateLimiter(redis)
    assert (await rl.try_acquire(m)).allowed
    assert (await rl.try_acquire(m)).allowed
    assert not (await rl.try_acquire(m)).allowed
    # The per-minute bucket was not charged by the denied call: 8 tokens remain.
    tokens = as_str(await redis.hget("rl:testprov:10/60s", "tokens"))
    assert float(tokens or 0) == pytest.approx(8, abs=0.1)


async def test_acquire_raises_when_wait_exceeds_budget(redis: Redis) -> None:
    m = manifest(RateWindow(requests=1, seconds=3600))
    rl = RateLimiter(redis)
    await rl.acquire(m)
    with pytest.raises(RateLimitedError):
        await rl.acquire(m, max_wait_s=0.05)


async def test_budget_counts_and_warns_at_80_percent(redis: Redis) -> None:
    m = manifest(RateWindow(requests=5, seconds=86400))
    rl = RateLimiter(redis)
    for _ in range(4):
        await rl.try_acquire(m)
    b = await rl.budget(m)
    assert (b.used_today, b.daily_limit, b.warning) == (4, 5, True)
