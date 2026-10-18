# Single image for api + worker. The API also serves the built SPA (one origin:
# simplest for the iPad Home Screen app and for Tailscale).

FROM node:22-slim AS web
WORKDIR /web
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM python:3.12-slim AS app
ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
RUN uv sync --frozen --no-dev
COPY config/ /app/config/
COPY --from=web /web/dist /app/static
RUN useradd --system --uid 10001 quarry
USER quarry
ENV PATH="/app/backend/.venv/bin:$PATH" CONFIG_DIR=/app/config STATIC_DIR=/app/static ENV=prod
EXPOSE 8000
CMD ["quarry-api"]
