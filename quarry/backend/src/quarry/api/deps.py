"""FastAPI dependencies: shared resources live on `app.state`, created in the lifespan."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from quarry.core.settings import Settings
from quarry.providers.config import FunctionsConfig, ProvidersConfig


@dataclass
class AppResources:
    settings: Settings
    engine: AsyncEngine
    sessions: async_sessionmaker[AsyncSession]
    redis: Redis
    providers: ProvidersConfig
    functions: FunctionsConfig
    features: dict[str, bool]


def get_resources(request: Request) -> AppResources:
    res: AppResources = request.app.state.resources
    return res


Resources = Annotated[AppResources, Depends(get_resources)]


async def get_session(res: Resources) -> AsyncIterator[AsyncSession]:
    async with res.sessions() as session:
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]
