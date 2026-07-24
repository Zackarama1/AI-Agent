"""
Local server for the Booking Agent app.

Wraps the existing agent + browser tools in an HTTP API and serves a
mobile-first web app (a PWA you can 'Add to Home Screen'). Run it:

    uvicorn webserver:app --host 0.0.0.0 --port 8000
    # or just: python webserver.py

Then open http://<this-machine-ip>:8000 on your phone (same Wi-Fi).

API:
    GET  /api/health              -> {ok, has_key}
    GET  /api/tasks               -> bundled task templates for the picker
    POST /api/runs   {instruction, start_url, mode}  -> {id, mode}
    GET  /api/runs/{id}           -> run summary
    GET  /api/runs/{id}/stream    -> Server-Sent Events, one per agent step
    GET  /demo/form               -> a local practice form (zero external deps)
"""

import asyncio
import json
import os
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agent_service import run_task_events
from jobs import JOBS, Job

BASE = Path(__file__).resolve().parent
WEB = BASE / "web"
TASKS = BASE / "tasks"

app = FastAPI(title="Booking Agent")


class RunRequest(BaseModel):
    instruction: str
    start_url: str
    mode: str = "auto"  # auto | real | dry_run


@app.get("/api/health")
def health():
    return {"ok": True, "has_key": bool(os.getenv("ANTHROPIC_API_KEY"))}


@app.get("/api/tasks")
def list_tasks():
    tasks = [{
        "name": "local_demo_signup",
        "start_url": "/demo/form",
        "instruction": ("Sign up for the newsletter as 'Test User' with email "
                        "'test-agent@example.com' and confirm the signup succeeded."),
        "note": "Runs fully locally — no API key or external site needed.",
    }]
    for f in sorted(TASKS.glob("*.yaml")):
        try:
            t = yaml.safe_load(f.read_text()) or {}
        except yaml.YAMLError:
            continue
        tasks.append({
            "name": t.get("name", f.stem),
            "start_url": t.get("start_url", ""),
            "instruction": (t.get("instruction") or "").strip(),
            "note": (t.get("notes") or "").strip(),
        })
    return tasks


@app.post("/api/runs")
async def create_run(req: RunRequest):
    mode = req.mode
    if mode == "auto":
        mode = "real" if os.getenv("ANTHROPIC_API_KEY") else "dry_run"
    if mode not in ("real", "dry_run"):
        raise HTTPException(400, f"unknown mode: {mode}")

    job = Job({"instruction": req.instruction, "start_url": req.start_url}, mode)
    JOBS[job.id] = job
    asyncio.create_task(_drive(job))
    return {"id": job.id, "mode": mode}


async def _drive(job: Job):
    job.status = "running"
    try:
        async for ev in run_task_events(job.task, mode=job.mode):
            if ev.get("type") == "result":
                job.outcome = ev.get("outcome")
                job.note = ev.get("note")
                job.steps = ev.get("steps", 0)
            await job.emit(ev)
        job.status = "done"
    except Exception as e:  # surface the failure to the UI instead of dying silently
        await job.emit({"type": "error", "message": f"{type(e).__name__}: {e}"})
        job.status = "error"
    finally:
        await job.emit({"type": "end"})
        job.finished.set()


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    job = JOBS.get(run_id)
    if not job:
        raise HTTPException(404, "no such run")
    return job.summary()


@app.get("/api/runs/{run_id}/stream")
async def stream_run(run_id: str):
    job = JOBS.get(run_id)
    if not job:
        raise HTTPException(404, "no such run")

    async def gen():
        q = await job.subscribe()
        try:
            while True:
                ev = await q.get()
                yield f"data: {json.dumps(ev)}\n\n"
                if ev.get("type") == "end":
                    break
        finally:
            await job.unsubscribe(q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/demo/form")
def demo_form():
    return FileResponse(WEB / "demo_form.html")


# Mount the PWA at the root LAST so the API routes above take precedence.
app.mount("/", StaticFiles(directory=str(WEB), html=True), name="web")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "webserver:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=bool(os.getenv("RELOAD")),
    )
