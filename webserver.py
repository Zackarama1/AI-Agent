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
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import auth
import emailer
import phone
import store
import venues
from adapters import adapter_for, real_url_for_venue
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


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class RecRequest(BaseModel):
    text: str
    rating: int = 5


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
            res = store.update_reservation(reservation_id, status=status)
            # Email the guest the moment we know the outcome. Non-fatal on error.
            if res and res.get("email") and status in ("confirmed", "failed", "needs_human"):
                try:
                    await asyncio.to_thread(emailer.send_booking_email, res, status, job.note or "")
                except Exception as e:
                    await job.emit({"type": "status", "message": f"(email skipped: {e})"})
        await job.emit({"type": "end"})
        job.finished.set()


def _booking_task(res: dict) -> dict:
    when = f"{res.get('date')} {res.get('time')}".strip()
    # When REAL_BOOKING is on, route a known venue to its real reservation page;
    # otherwise (and by default) the adapter falls back to the local demo flow.
    start_url = res.get("start_url", "")
    if not start_url:
        v = VENUE_BY_NAME.get(res.get("venue", ""))
        if v:
            start_url = real_url_for_venue(v["id"]) or ""
    adapter = adapter_for(start_url, res.get("venue", ""))
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
    from browser_tools import browserbase_connect_url
    return {
        "ok": True,
        "has_key": bool(os.getenv("ANTHROPIC_API_KEY")),
        "hosted_browser": bool(browserbase_connect_url()),
    }


# ---------- auth ----------

def current_user(authorization: str | None = Header(None)) -> dict | None:
    """Resolve the logged-in user from a `Bearer <token>` header, or None."""
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    uid = auth.user_id_for_token(token)
    return store.get_user(uid) if uid else None


def require_user(authorization: str | None = Header(None)) -> dict:
    user = current_user(authorization)
    if not user:
        raise HTTPException(401, "Please sign in.")
    return user


@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    email = req.email.lower().strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "Enter a valid email address.")
    if len(req.password) < 8:
        raise HTTPException(400, "Use a password of at least 8 characters.")
    if store.get_user_by_email(email):
        raise HTTPException(409, "That email is already registered — try signing in.")
    name = req.name.strip() or email.split("@")[0].title()
    user = store.create_user(email, name, auth.hash_password(req.password))
    return {"token": auth.create_token(user["id"]), "user": user}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    row = store.get_user_by_email(req.email)
    if not row or not auth.verify_password(req.password, row["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect.")
    user = {"id": row["id"], "email": row["email"], "name": row["name"]}
    return {"token": auth.create_token(user["id"]), "user": user}


@app.get("/api/auth/me")
def me(user: dict = Depends(require_user)):
    return user


VENUES = venues.VENUES
VENUE_BY_ID = {v["id"]: v for v in VENUES}
VENUE_BY_NAME = {v["name"]: v for v in VENUES}


@app.get("/api/venues")
def list_venues(q: str = "", location: str = ""):
    """Curated multi-city catalog by default; a live provider (Yelp/Google
    Places) when VENUE_PROVIDER + a key are configured (see venues.py)."""
    return venues.list_venues(q, location)


@app.get("/api/cities")
def list_cities():
    seen = []
    for v in VENUES:
        if v["city"] not in seen:
            seen.append(v["city"])
    return seen


# ---------- recommendations / community ----------

_SEED_RECS = [
    ("nopa", "Ava R.", 5, "The wood-fired lamb is unreal, and they actually held our 9:30 table. Go late."),
    ("tasting-room", "Marcus L.", 5, "Booked the chef's counter for our anniversary — best meal of the year."),
    ("zuni", "Priya S.", 4, "Come for the roast chicken (order it the second you sit down) and the oysters."),
    ("state-bird", "Dan K.", 5, "Impossible to get in — the agent grabbed a 7:30 cancellation for us. Worth it."),
    ("kokkari", "Sofia M.", 5, "That fireplace room in winter is magic. The meze spread is huge, bring friends."),
    ("rich-table", "Leo T.", 4, "Porcini doughnuts, sardine chips, done. Sit at the bar if you're a two-top."),
]


def _seed_recs_once():
    if store.recommendations_count() == 0:
        for vid, author, rating, text in _SEED_RECS:
            v = VENUE_BY_ID.get(vid, {})
            store.add_recommendation({"venue_id": vid, "venue": v.get("name", ""),
                                      "author": author, "rating": rating, "text": text,
                                      "likes": 3 + (rating * 2)})


@app.get("/api/venues/{venue_id}/recommendations")
def venue_recs(venue_id: str):
    return store.list_recommendations(venue_id)


@app.post("/api/venues/{venue_id}/recommendations")
def add_venue_rec(venue_id: str, req: RecRequest, user: dict = Depends(require_user)):
    v = VENUE_BY_ID.get(venue_id, {})
    return store.add_recommendation({
        "venue_id": venue_id, "venue": v.get("name", ""), "user_id": user["id"],
        "author": user["name"], "rating": max(1, min(req.rating, 5)), "text": req.text.strip(),
    })


@app.on_event("startup")
def _startup():
    _seed_recs_once()


@app.get("/api/community")
def community():
    """Feed of recommendations, newest first, joined with venue metadata."""
    recs = store.list_recommendations(None, limit=50)
    for r in recs:
        v = VENUE_BY_ID.get(r["venue_id"], {})
        r["cuisine"] = v.get("cuisine", "")
        r["neighborhood"] = v.get("neighborhood", "")
        r["photo"] = v.get("photo", "slate")
    return recs


@app.post("/api/recommendations/{rec_id}/like")
def like_rec(rec_id: str):
    rec = store.like_recommendation(rec_id)
    if not rec:
        raise HTTPException(404, "No such recommendation.")
    return rec


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
def reservations(user: dict = Depends(require_user)):
    return store.list_reservations(user_id=user["id"])


@app.post("/api/reservations")
def create_reservation(intent: Intent, user: dict = Depends(require_user)):
    data = intent.model_dump()
    data["user_id"] = user["id"]
    data["email"] = user["email"]
    if not data.get("name"):
        data["name"] = user["name"]
    return store.create_reservation(data)


def _owned(rid: str, user: dict) -> dict:
    res = store.get_reservation(rid)
    if not res:
        raise HTTPException(404, "no such reservation")
    if res.get("user_id") and res["user_id"] != user["id"]:
        raise HTTPException(403, "not your reservation")
    return res


@app.get("/api/reservations/{rid}")
def one_reservation(rid: str, user: dict = Depends(require_user)):
    return _owned(rid, user)


@app.post("/api/reservations/{rid}/book")
async def book_reservation(rid: str, mode: str = "auto", user: dict = Depends(require_user)):
    res = _owned(rid, user)
    m = _mode_from(mode)
    job = _start_agent(_booking_task(res), m, reservation_id=rid)
    return {"reservation_id": rid, "run_id": job.id, "mode": m}


@app.post("/api/reservations/{rid}/cancel")
def cancel_reservation(rid: str, user: dict = Depends(require_user)):
    _owned(rid, user)
    return store.update_reservation(rid, status="cancelled")


@app.post("/api/reservations/{rid}/call")
async def call_reservation(rid: str, user: dict = Depends(require_user)):
    """Phone-agent booking: the AI calls the venue. Streams the call over the
    same /runs/{id}/stream channel. Uses a real voice provider when configured,
    otherwise a simulated (dry-run) call."""
    res = _owned(rid, user)
    job = Job({"reservation": res}, "phone")
    JOBS[job.id] = job
    asyncio.create_task(_drive_call(job, res))
    return {"reservation_id": rid, "run_id": job.id, "configured": phone.phone_configured()}


async def _drive_call(job: Job, res: dict):
    job.status = "running"
    store.update_reservation(res["id"], status="pending", method="phone", run_id=job.id)
    try:
        mode = "real" if phone.phone_configured() else "dry_run"
        async for ev in phone.run_call_events(res, mode=mode):
            if ev.get("type") == "result":
                job.outcome = ev.get("outcome")
                job.note = ev.get("note")
            await job.emit(ev)
        job.status = "done"
    except Exception as e:
        await job.emit({"type": "error", "message": f"{type(e).__name__}: {e}"})
        job.outcome = "failed"
    finally:
        status = {"success": "confirmed", "needs_human": "needs_human",
                  "failed": "failed"}.get(job.outcome or "failed", "failed")
        updated = store.update_reservation(res["id"], status=status)
        if updated and updated.get("email") and status in ("confirmed", "failed"):
            try:
                await asyncio.to_thread(emailer.send_booking_email, updated, status, job.note or "")
            except Exception:
                pass
        await job.emit({"type": "end"})
        job.finished.set()


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
