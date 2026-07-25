"""
Phone-agent path: the AI calls the venue to book a table — for places with no
online form (or when the form fails).

Two modes, same event stream:
  - real:    place a call via a voice provider (Vapi / Bland / Retell / Twilio)
             when PHONE_PROVIDER + its key are set. The provider runs the live
             voice model; completion arrives via its webhook, so we mark the
             reservation "needs_human" until confirmed.
  - dry_run: a simulated, testable call — a phased animation + a spoken
             transcript ending in a confirmation. No key, no cost.

Every call opens with an AI-caller disclosure. Several US states require
disclosing an automated caller and/or two-party consent to record — keep the
disclosure, and gate recording on the venue's location before going live.

Events yielded (JSON-serialisable):
  {"type":"status","message":str}
  {"type":"phase","emoji":str,"title":str,"sub":str,"progress":float}
  {"type":"transcript","speaker":"ai"|"host","text":str}
  {"type":"result","outcome":str,"note":str}
"""

import asyncio
import json
import os
import urllib.request

DISCLOSURE = ("Hi, this is an automated assistant calling on behalf of {name} "
              "to book a table. This call may be handled by AI.")


def phone_provider() -> str | None:
    p = (os.getenv("PHONE_PROVIDER") or "").lower().strip()
    keymap = {"vapi": "VAPI_API_KEY", "bland": "BLAND_API_KEY",
              "retell": "RETELL_API_KEY", "twilio": "TWILIO_AUTH_TOKEN"}
    if p and os.getenv(keymap.get(p, "")):
        return p
    return None


def phone_configured() -> bool:
    return phone_provider() is not None


def _to12(t: str) -> str:
    try:
        h, m = (int(x) for x in (t or "19:00").split(":"))
        ap = "PM" if h >= 12 else "AM"
        return f"{((h + 11) % 12) + 1}:{m:02d} {ap}"
    except Exception:
        return "7:00 PM"


async def run_call_events(res: dict, mode: str = "dry_run"):
    venue = res.get("venue") or "the restaurant"
    name = res.get("name") or "the guest"
    party = res.get("party_size") or 2
    when = _to12(res.get("time"))
    if mode == "real" and phone_configured():
        async for ev in _real_call(res, venue, name, party, when):
            yield ev
        return
    async for ev in _sim_call(venue, name, party, when):
        yield ev


async def _sim_call(venue, name, party, when):
    yield {"type": "status", "message": f"Dialing {venue}…"}
    yield {"type": "phase", "emoji": "📞", "title": f"Calling {venue}", "sub": "Connecting…", "progress": 0.15}
    await asyncio.sleep(0.9)
    yield {"type": "phase", "emoji": "🎙️", "title": "On the line", "sub": "Introducing the request", "progress": 0.4}
    yield {"type": "transcript", "speaker": "ai", "text": DISCLOSURE.format(name=name)}
    await asyncio.sleep(0.9)
    yield {"type": "transcript", "speaker": "host", "text": f"Of course — for how many, and what time?"}
    await asyncio.sleep(0.7)
    yield {"type": "transcript", "speaker": "ai", "text": f"A table for {party} at {when}, please."}
    await asyncio.sleep(0.8)
    yield {"type": "phase", "emoji": "📖", "title": "Checking the book", "sub": "Host is looking for a table", "progress": 0.68}
    yield {"type": "transcript", "speaker": "host", "text": f"Let me check… yes, {when} works."}
    await asyncio.sleep(0.9)
    yield {"type": "phase", "emoji": "🔒", "title": "Confirming", "sub": "Locking in the booking", "progress": 0.9}
    yield {"type": "transcript", "speaker": "ai", "text": f"Perfect — please put it under {name}."}
    await asyncio.sleep(0.7)
    yield {"type": "transcript", "speaker": "host", "text": f"Done! See {name} at {when}."}
    await asyncio.sleep(0.5)
    yield {"type": "result", "outcome": "success",
           "note": f"The venue confirmed a table for {party} at {when} over the phone."}


async def _real_call(res, venue, name, party, when):
    provider = phone_provider()
    to_number = res.get("phone") or ""   # the venue's number (store per-venue in prod)
    yield {"type": "status", "message": f"Placing a call via {provider}…"}
    yield {"type": "phase", "emoji": "📞", "title": f"Calling {venue}", "sub": f"via {provider}", "progress": 0.3}
    try:
        await asyncio.to_thread(_dispatch_call, provider, to_number, res, name, party, when)
        yield {"type": "phase", "emoji": "🎙️", "title": "Call in progress", "sub": "The AI is on the line", "progress": 0.6}
        yield {"type": "result", "outcome": "needs_human",
               "note": ("Call placed. You'll get an update when the venue confirms — "
                        "provider webhooks report the final result.")}
    except Exception as e:
        yield {"type": "result", "outcome": "failed", "note": f"Couldn't place the call: {e}"}


def _dispatch_call(provider, to_number, res, name, party, when):
    """Kick off a provider call. Minimal happy-path bodies; wire the provider's
    webhook to POST the final outcome back to your server."""
    task = (f"Book a table for {party} at {res.get('venue')} at {when} under {name}. "
            f"Open by disclosing you are an automated assistant.")
    if provider == "vapi":
        _post("https://api.vapi.ai/call",
              {"Authorization": f"Bearer {os.getenv('VAPI_API_KEY','')}"},
              {"phoneNumber": {"twilioPhoneNumber": os.getenv("PHONE_FROM_NUMBER", "")},
               "customer": {"number": to_number}, "assistant": {"firstMessage": DISCLOSURE.format(name=name),
               "model": {"provider": "openai", "model": "gpt-4o"}, "task": task}})
    elif provider == "bland":
        _post("https://api.bland.ai/v1/calls",
              {"Authorization": os.getenv("BLAND_API_KEY", "")},
              {"phone_number": to_number, "task": task, "from": os.getenv("PHONE_FROM_NUMBER", "")})
    elif provider == "retell":
        _post("https://api.retellai.com/v2/create-phone-call",
              {"Authorization": f"Bearer {os.getenv('RETELL_API_KEY','')}"},
              {"from_number": os.getenv("PHONE_FROM_NUMBER", ""), "to_number": to_number})
    else:  # twilio: kick off a call that points at your TwiML/Media-Streams app
        raise RuntimeError("Twilio path needs a TwiML/Media-Streams app URL — see README.")


def _post(url, headers, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json", **headers}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status
