"""Redis/Valkey client factory (the redis-py client speaks to both)."""

from __future__ import annotations

from redis.asyncio import Redis


def make_redis(url: str) -> Redis:
    return Redis.from_url(url, decode_responses=True, health_check_interval=30)


def as_str(value: bytes | str | None) -> str | None:
    """Clients use decode_responses=True; this narrows redis-py's bytes|str typing."""
    if isinstance(value, bytes):
        return value.decode()
    return value


async def ping(redis: Redis) -> bool:
    try:
        return bool(await redis.ping())
    except Exception:
        return False
