"""`quarry-api` entrypoint."""

from __future__ import annotations

import uvicorn

from quarry.core.settings import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "quarry.api.app:create_app",
        factory=True,
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.env == "dev",
        log_config=None,
        proxy_headers=False,
    )


if __name__ == "__main__":
    main()
