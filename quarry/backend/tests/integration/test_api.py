from __future__ import annotations

import httpx
import pytest
from redis.asyncio import Redis

from quarry.worker.__main__ import heartbeat

pytestmark = pytest.mark.integration


async def test_health_degraded_without_worker_then_ok(
    client: httpx.AsyncClient, redis: Redis
) -> None:
    r = await client.get("/api/health")
    assert r.status_code == 503
    assert r.json()["checks"] == {"database": True, "redis": True, "worker": False}
    await heartbeat(redis)
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_status_reports_provider_states(client: httpx.AsyncClient) -> None:
    body = (await client.get("/api/status")).json()
    states = {p["id"]: p["state"] for p in body["providers"]}
    assert states["finnhub"] == "idle"  # key configured in fixture
    assert states["alpaca"] == "unconfigured"
    assert states["ibkr"] == "disabled"
    fred = next(p for p in body["providers"] if p["id"] == "fred")
    assert "FRED" in fred["attribution_text"]
    assert body["base_currency"] == "GBP"


async def test_status_never_leaks_keys(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/status")
    assert "test-finnhub-key-123" not in r.text


async def test_functions_registry(client: httpx.AsyncClient) -> None:
    body = (await client.get("/api/functions")).json()
    codes = {f["code"]: f for f in body["functions"]}
    assert codes["HELP"]["available"] is True
    assert codes["GP"]["needs_security"] is True
    assert body["sector_suffixes"]["EQ"] == "Equity"


async def test_workspace_roundtrip(client: httpx.AsyncClient) -> None:
    panels = {"p1": {"command": "VOD LN DES"}}
    layout = {"grid": {"root": "x"}, "panels": panels}
    r = await client.put("/api/workspaces/UK Morning", json={"layout": layout})
    assert r.status_code == 200
    r = await client.put(
        "/api/workspaces/UK Morning",
        json={"layout": {"panes": ["GP"]}},
        params={"form_factor": "tablet"},
    )
    assert r.status_code == 200
    got = (await client.get("/api/workspaces/UK Morning")).json()
    assert got["layout"] == layout
    panels["p1"]["command"] = "AAPL US GP"
    await client.put("/api/workspaces/UK Morning", json={"layout": layout})
    got = (await client.get("/api/workspaces/UK Morning")).json()
    assert got["layout"]["panels"]["p1"]["command"] == "AAPL US GP"
    names = [w["name"] for w in (await client.get("/api/workspaces")).json()]
    assert names == ["UK Morning"]
    assert (await client.delete("/api/workspaces/UK Morning")).status_code == 204
    assert (await client.get("/api/workspaces/UK Morning")).status_code == 404
    tablet = await client.get("/api/workspaces/UK Morning", params={"form_factor": "tablet"})
    assert tablet.json()["layout"] == {"panes": ["GP"]}


async def test_errors_have_consistent_shape(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/workspaces/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"
    r = await client.put("/api/workspaces/..%2Fetc", json={"layout": {}})
    assert r.status_code in (404, 422)
    r = await client.get("/api/workspaces/x", params={"form_factor": "phone"})
    assert r.json()["error"]["code"] == "invalid_request"


async def test_command_history(client: httpx.AsyncClient) -> None:
    for c in ("VOD LN DES", "AAPL US GP 1Y"):
        assert (await client.post("/api/history", json={"command": c})).status_code == 201
    hist = (await client.get("/api/history")).json()
    assert [h["command"] for h in hist] == ["AAPL US GP 1Y", "VOD LN DES"]


async def test_security_headers(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/functions")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
