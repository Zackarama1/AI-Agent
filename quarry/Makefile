# QUARRY developer commands. `make help` lists them.
.DEFAULT_GOAL := help
SHELL := /bin/bash

BACKEND := backend
FRONTEND := frontend
UV := cd $(BACKEND) && uv run
PNPM := cd $(FRONTEND) && pnpm

help: ## List targets
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[33m%-12s\033[0m %s\n",$$1,$$2}'

install: ## Install backend + frontend dependencies
	cd $(BACKEND) && uv sync
	$(PNPM) install --frozen-lockfile

up: ## Build and start the full stack in Docker (http://127.0.0.1:8000)
	docker compose up --build -d
	@echo "QUARRY: http://127.0.0.1:8000  (health: /health)"

down: ## Stop the Docker stack
	docker compose down

dev: ## Hot-reload dev: databases in Docker, api + worker + Vite locally (http://localhost:5173)
	docker compose up -d db cache
	$(MAKE) migrate
	./scripts/dev.sh

dev-native: ## Like dev, but uses Postgres/Redis you already run (DATABASE_URL, REDIS_URL)
	$(MAKE) migrate
	./scripts/dev.sh

migrate: ## Apply database migrations
	$(UV) alembic upgrade head

test: ## Backend + frontend unit/integration tests
	$(UV) pytest
	$(PNPM) test

lint: ## Lint, format check and type-check everything
	$(UV) ruff check .
	$(UV) ruff format --check .
	$(UV) mypy src tests
	$(PNPM) lint
	$(PNPM) format:check
	$(PNPM) typecheck

format: ## Auto-format
	$(UV) ruff format .
	$(UV) ruff check --fix .
	$(PNPM) format

openapi: ## Regenerate the frontend's typed API client from the backend schema
	$(UV) python -m quarry.api.openapi > openapi.json
	$(PNPM) gen:api

build: ## Production build of the SPA
	$(PNPM) build
	$(PNPM) check:bundle

e2e: build ## Playwright E2E against the full stack (needs the stack running with STATIC_DIR=frontend/dist)
	$(PNPM) e2e

seed: ## Seed reference data (Phase 1)
	@echo "Reference-data seeding arrives in Phase 1."

backfill: ## Historical backfill (Phase 1)
	@echo "Backfill tools arrive in Phase 1."

.PHONY: help install up down dev dev-native migrate test lint format openapi build e2e seed backfill
