"""Alembic environment (async engine, URL from QUARRY settings)."""

from __future__ import annotations

import asyncio

from alembic import context
from sqlalchemy.engine import Connection

from quarry.core.settings import get_settings
from quarry.storage.db import make_engine
from quarry.storage.models import Base

target_metadata = Base.metadata


def _run(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def _run_async() -> None:
    engine = make_engine(get_settings().database_url)
    async with engine.connect() as conn:
        await conn.run_sync(_run)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(url=get_settings().database_url, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(_run_async())
