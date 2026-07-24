"""
Local server for the Booking Agent app.

Wraps the AI agent + browser tools in an HTTP API and serves a mobile-first
PWA (the app you install on your phone). Run it:

    uvicorn webserver:app --host 0.0.0.0 --port 8000
    # or: python webserver.py

Then open http://<this-machine-ip>:8000 on your phone (same Wi-Fi).

API overview:
    GET  /api/health                    -> {ok, has_key}
    GET  /api/tasks                     -> demo task templates
    POST /api/parse   {prompt}          -> structured booking intent
    GET  /api/reservations              -> list (feeds the calendar)
    POST /api/reservations {intent}     -> create a reservation (draft)
    GET  /api/reservations/{id}         -> one reservation
    POST /api/reservations/{id}/book    -> run the AI agent to book it -> {run_id}
    POST /api/reservations/{id}/cancel  -> mark cancelled
    POST /api/reservations/{id}/call    -> phone-agent (stub until Twilio wired)
    GET  /api/reservations.ics          -> subscribe from iOS/Android calendar
    POST /api/runs   {instruction,...}  -> low-level: start any agent run
    GET  /api/runs/{id}/stream          -> Server-Sent Events, one per step
    GET  /demo/form                     -> a local practice form (no deps)
"""

import asyncio
import json
import os
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import store
from adapters import adapter_for
from agent_service import run_task_events
from jobs import JOBS, Job
from nlu import parse_booking

BASE = Path(__file__).resolve().parent
WEB = BASE / "web"
TASKS = BASE / "tasks"

app = FastAPI(title="Booking Agent")

# The native app (Capacitor) loads from capacitor://localhost / http://localhost
# and calls this API cross-origin, so CORS must be open to it. We don't use
# cookies, so a permissive default is safe; lock it down with ALLOWED_ORIGINS
# (comma-separated) in production if you prefer.
_origins = os.getenv("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _origins.strip() == "*" else [o.strip() for o in _origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- models ----------

class RunRequest(BaseModel):
    instruction: str
    start_url: str
    mode: str = "auto"  # auto | real | dry_run


class ParseRequest(BaseModel):
    prompt: str


class Intent(BaseModel):
    venue: str = ""
    start_url: str = ""
    party_size: int = 2
    date: str = ""
    time: str = ""
    name: str = ""
    phone: str = ""
    notes: str = ""
    method: str = "agent"
    source_prompt: str = ""


# ---------- helpers ----------

def _mode_from(requested: str) -> str:
    if requested == "auto":
        return "real" if os.getenv("ANTHROPIC_API_KEY") else "dry_run"
    if requested not in ("real", "dry_run"):
        raise HTTPException(400, f"unknown mode: {requested}")
    return requested


def _start_agent(task: dict, mode: str, reservation_id: str | None = None) -> Job:
    job = Job(task, mode)
    JOBS[job.id] = job
    asyncio.create_task(_drive(job, reservation_id))
    return job


async def _drive(job: Job, reservation_id: str | None = None):
    job.status = "running"
    if reservation_id:
        store.update_reservation(reservation_id, status="pending", run_id=job.id)
    try:
        async for ev in run_task_events(job.task, mode=job.mode):
            if ev.get("type") == "result":
                job.outcome = ev.get("outcome")
                job.note = ev.get("note")
                job.steps = ev.get("steps", 0)
            await job.emit(ev)
        job.status = "done"
    except Exception as e:
        await job.emit({"type": "error", "message": f"{type(e).__name__}: {e}"})
        job.status = "error"
        job.outcome = "failed"
    finally:
        if reservation_id:
            status = {"success": "confirmed", "needs_human": "needs_human",
                      "failed": "failed"}.get(job.outcome or "failed", "failed")
            store.update_reservation(reservation_id, status=status)
        await job.emit({"type": "end"})
        job.finished.set()


def _booking_task(res: dict) -> dict:
    when = f"{res.get('date')} {res.get('time')}".strip()
    adapter = adapter_for(res.get("start_url", ""), res.get("venue", ""))
    instruction = (
        f"Book a table for {res.get('party_size')} at {res.get('venue') or 'the venue'} "
        f"on {when} under the name '{res.get('name') or 'the guest'}'"
        + (f", phone {res['phone']}" if res.get("phone") else "")
        + (f". Notes: {res['notes']}" if res.get("notes") else "")
        + ". If the exact time is unavailable, pick the closest within 30 minutes and note it. "
        "If a card is required to hold the table, call submit_payment (simulated). "
        "Confirm the booking before finishing."
        + (f"\n\nSite notes: {adapter['hints']}" if adapter.get("hints") else "")
    )
    # adapter resolves a blank URL to the built-in demo restaurant, so a keyless
    # dry-run always has a realistic multi-step target. The structured hints let
    # the dry-run filler use the real time/guest without scraping the prose.
    return {
        "instruction": instruction,
        "start_url": adapter["start_url"],
        "time_hint": _to_ampm(res.get("time", "")),
        "guest": {"name": res.get("name", ""), "phone": res.get("phone", "")},
    }


def _to_ampm(t: str) -> str:
    try:
        h, m = (int(x) for x in t.split(":"))
        ap = "PM" if h >= 12 else "AM"
        return f"{((h + 11) % 12) + 1}:{m:02d} {ap}"
    except (ValueError, AttributeError):
        return ""


# ---------- basic ----------

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


# ---------- natural language / voice ----------

@app.post("/api/parse")
def parse(req: ParseRequest):
    if not req.prompt.strip():
        raise HTTPException(400, "empty prompt")
    intent = parse_booking(req.prompt)
    intent["used_model"] = bool(os.getenv("ANTHROPIC_API_KEY"))
    return intent


# ---------- reservations / calendar ----------

@app.get("/api/reservations")
def reservations():
    return store.list_reservations()


@app.post("/api/reservations")
def create_reservation(intent: Intent):
    res = store.create_reservation(intent.model_dump())
    return res


@app.get("/api/reservations/{rid}")
def one_reservation(rid: str):
    res = store.get_reservation(rid)
    if not res:
        raise HTTPException(404, "no such reservation")
    return res


@app.post("/api/reservations/{rid}/book")
async def book_reservation(rid: str, mode: str = "auto"):
    res = store.get_reservation(rid)
    if not res:
        raise HTTPException(404, "no such reservation")
    m = _mode_from(mode)
    job = _start_agent(_booking_task(res), m, reservation_id=rid)
    return {"reservation_id": rid, "run_id": job.id, "mode": m}


@app.post("/api/reservations/{rid}/cancel")
def cancel_reservation(rid: str):
    res = store.update_reservation(rid, status="cancelled")
    if not res:
        raise HTTPException(404, "no such reservation")
    return res


@app.post("/api/reservations/{rid}/call")
def call_reservation(rid: str):
    """Phone-agent booking. Stubbed until a voice provider is wired up
    (Twilio Voice + a realtime voice model, or Vapi/Bland/Retell)."""
    res = store.get_reservation(rid)
    if not res:
        raise HTTPException(404, "no such reservation")
    return {
        "configured": False,
        "message": ("Phone-agent mode is not configured on this server. Wire up a "
                    "voice provider (see README > Phone agent) and set the venue's "
                    "phone number to enable AI calls."),
        "would_call": res.get("phone") or "(no phone on file)",
        "reservation_id": rid,
    }


@app.get("/api/reservations.ics")
def reservations_ics():
    body = store.to_ics(store.list_reservations())
    return PlainTextResponse(body, media_type="text/calendar")


# ---------- low-level agent runs ----------

@app.post("/api/runs")
async def create_run(req: RunRequest):
    m = _mode_from(req.mode)
    job = _start_agent({"instruction": req.instruction, "start_url": req.start_url}, m)
    return {"id": job.id, "mode": m}


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


@app.get("/demo/reserve")
def demo_reserve():
    return FileResponse(WEB / "reserve_demo.html")


# Serve the PWA at the root LAST so API routes take precedence.
app.mount("/", StaticFiles(directory=str(WEB), html=True), name="web")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "webserver:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=bool(os.getenv("RELOAD")),
    )
