"""Command registry for the terminal's command line, HELP and autocomplete."""

from __future__ import annotations

from fastapi import APIRouter

from quarry.api.deps import Resources
from quarry.providers.config import FunctionsConfig

router = APIRouter(tags=["terminal"])


@router.get("/functions", response_model=FunctionsConfig)
async def list_functions(res: Resources) -> FunctionsConfig:
    return res.functions
