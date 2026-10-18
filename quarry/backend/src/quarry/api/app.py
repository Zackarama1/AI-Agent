"""FastAPI application factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from quarry import __version__
from quarry.api.deps import AppResources
from quarry.api.routers import functions, health, workspaces
from quarry.core.errors import QuarryError
from quarry.core.logging import configure_logging
from quarry.core.settings import Settings, get_settings
from quarry.providers.config import cached_functions, cached_providers, load_features
from quarry.storage.cache import make_redis
from quarry.storage.db import make_engine, make_sessionmaker

log = structlog.get_logger("quarry.api")

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        for k, v in _SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        return response


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.secret_values())
    # Validate config at startup so a bad YAML fails fast, not on first request.
    providers = cached_providers(settings.config_dir)
    functions_cfg = cached_functions(settings.config_dir)
    features = load_features(settings.config_dir)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = make_engine(settings.database_url)
        redis = make_redis(settings.redis_url)
        app.state.resources = AppResources(
            settings=settings,
            engine=engine,
            sessions=make_sessionmaker(engine),
            redis=redis,
            providers=providers,
            functions=functions_cfg,
            features=features,
        )
        log.info("api.start", version=__version__, mode=settings.mode.value)
        try:
            yield
        finally:
            await redis.aclose()
            await engine.dispose()

    app = FastAPI(
        title="QUARRY API",
        version=__version__,
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(SecurityHeaders)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "PUT", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(QuarryError)
    async def _quarry_error(_: Request, exc: QuarryError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message, "detail": exc.detail}},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "invalid_request",
                    "message": "request failed validation",
                    "detail": {"errors": exc.errors()},
                }
            },
        )

    for r in (health.router, functions.router, workspaces.router):
        app.include_router(r, prefix="/api")
    # Unprefixed liveness for container healthchecks.
    app.add_api_route("/health", health.health, methods=["GET"], include_in_schema=False)

    if settings.static_dir is not None:
        _mount_spa(app, settings.static_dir)
    return app


def _mount_spa(app: FastAPI, static_dir: Path) -> None:
    """Serve the built SPA from the same origin (simplest for the iPad PWA + Tailscale)."""
    index = static_dir / "index.html"
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> Response:  # sync: FastAPI runs it in the threadpool
        if path.startswith("api/"):
            return JSONResponse(status_code=404, content={"error": {"code": "not_found"}})
        candidate = (static_dir / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(static_dir.resolve()):
            headers = {"Cache-Control": "no-cache"} if path == "sw.js" else None
            return FileResponse(candidate, headers=headers)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
