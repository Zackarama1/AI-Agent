"""
Turn a spoken/typed request ("book me a table for 2 at Nopa this Friday at 7")
into a structured booking intent.

Two paths:
  - Claude (if ANTHROPIC_API_KEY is set): tool-use with a strict schema, best
    quality, handles messy phrasing.
  - Heuristic fallback (no key): regex + a small date/time grammar so the demo
    and offline dev still produce a sensible intent.

Both return the same dict shape:
  {venue, party_size, date (YYYY-MM-DD), time (HH:MM 24h), name, phone,
   notes, confidence (0-1), assumptions: [str]}
"""

import os
import re
from datetime import date, datetime, timedelta

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

INTENT_SCHEMA = {
    "type": "object",
    "properties": {
        "venue": {"type": "string", "description": "Restaurant/venue name, '' if not stated"},
        "party_size": {"type": "integer"},
        "date": {"type": "string", "description": "ISO date YYYY-MM-DD"},
        "time": {"type": "string", "description": "24h HH:MM"},
        "name": {"type": "string"},
        "phone": {"type": "string"},
        "notes": {"type": "string", "description": "e.g. 'window seat', 'anniversary'"},
        "confidence": {"type": "number"},
        "assumptions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["party_size", "date", "time", "confidence"],
}


def parse_booking(prompt: str, now: datetime | None = None) -> dict:
    now = now or datetime.now()
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            return _parse_with_claude(prompt, now)
        except Exception:
            pass  # fall back rather than fail the request
    return _parse_heuristic(prompt, now)


# ---- Claude path ----

def _parse_with_claude(prompt: str, now: datetime) -> dict:
    from anthropic import Anthropic

    client = Anthropic()
    system = (
        "Extract a restaurant booking intent from the user's message. "
        f"Today is {now:%A, %Y-%m-%d} and the current time is {now:%H:%M}. "
        "Resolve relative dates ('tonight', 'this Friday', 'tomorrow') to a concrete "
        "ISO date. Default party_size to 2 and time to 19:00 if truly unspecified, "
        "and record that in assumptions. Use 24h time. Call the tool exactly once."
    )
    resp = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=512,
        system=system,
        tools=[{
            "name": "booking_intent",
            "description": "Return the structured booking intent.",
            "input_schema": INTENT_SCHEMA,
        }],
        tool_choice={"type": "tool", "name": "booking_intent"},
        messages=[{"role": "user", "content": prompt}],
    )
    for block in resp.content:
        if block.type == "tool_use":
            return _normalise(block.input, prompt)
    raise RuntimeError("model did not return the tool")


# ---- Heuristic path ----

def _parse_heuristic(prompt: str, now: datetime) -> dict:
    p = prompt.lower().strip()
    assumptions: list[str] = []

    # party size: "for 4", "table for two", "party of 3", "4 people"
    party = None
    words = {"a": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
             "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
    m = re.search(r"(?:for|party of|table for)\s+(\d+|" + "|".join(words) + r")\b", p)
    if not m:
        m = re.search(r"\b(\d+)\s+(?:people|guests|of us|pax)\b", p)
    if m:
        tok = m.group(1)
        party = int(tok) if tok.isdigit() else words.get(tok)
    if not party:
        party = 2
        assumptions.append("Assumed a party of 2.")

    # time: "7pm", "7:30 pm", "19:00", "at 8"
    tm = _extract_time(p)
    if not tm:
        tm = "19:00"
        assumptions.append("Assumed 7:00 PM.")

    # date: tonight/today/tomorrow/this <weekday>/next <weekday>/<weekday>
    d, date_assumed = _extract_date(p, now)
    if date_assumed:
        assumptions.append(date_assumed)

    # venue: "at <name>" up to a date/time keyword
    venue = ""
    vm = re.search(r"\bat\s+([a-z0-9'&.\- ]+?)(?:\s+(?:for|on|this|next|tonight|today|tomorrow|at|\d)|$)", prompt, re.I)
    if vm:
        venue = vm.group(1).strip().rstrip(".")

    # notes: quick keyword grabs
    notes = []
    for kw in ("window", "outdoor", "patio", "booth", "quiet", "anniversary", "birthday", "vegan", "allergy"):
        if kw in p:
            notes.append(kw)

    confidence = 0.4 + 0.15 * bool(venue) + 0.15 * (not assumptions) + 0.1 * bool(tm)
    return _normalise({
        "venue": venue,
        "party_size": party,
        "date": d,
        "time": tm,
        "name": "",
        "phone": "",
        "notes": ", ".join(notes),
        "confidence": round(min(confidence, 0.95), 2),
        "assumptions": assumptions,
    }, prompt)


def _extract_time(p: str) -> str | None:
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", p)
    if m:
        hh = int(m.group(1)) % 12
        if m.group(3) == "pm":
            hh += 12
        return f"{hh:02d}:{int(m.group(2) or 0):02d}"
    m = re.search(r"\b(\d{1,2}):(\d{2})\b", p)  # bare "7:30"
    if m:
        hh = int(m.group(1))
        # Dining bias: a bare 1–10 o'clock without am/pm means evening, unless
        # the request is clearly a brunch/lunch/breakfast.
        if hh <= 10 and not re.search(r"brunch|lunch|breakfast|morning|am\b", p):
            hh += 12
        return f"{hh:02d}:{m.group(2)}"
    if "tonight" in p or "this evening" in p:
        return "19:00"
    if "lunch" in p:
        return "12:30"
    m = re.search(r"\bat\s+(\d{1,2})\b", p)  # "at 8" -> assume evening
    if m:
        hh = int(m.group(1))
        if hh < 12:
            hh += 12
        return f"{hh:02d}:00"
    return None


def _extract_date(p: str, now: datetime) -> tuple[str, str | None]:
    today = now.date()
    if "tonight" in p or "today" in p or "this evening" in p:
        return today.isoformat(), None
    if "tomorrow" in p:
        return (today + timedelta(days=1)).isoformat(), None
    for i, wd in enumerate(WEEKDAYS):
        if wd in p:
            delta = (i - today.weekday()) % 7
            if delta == 0 or "next" in p:
                delta = 7 if ("next" in p or delta == 0) else delta
            return (today + timedelta(days=delta)).isoformat(), None
    # default: next Friday, and say so
    delta = (4 - today.weekday()) % 7 or 7
    return (today + timedelta(days=delta)).isoformat(), "No date given — assumed the coming Friday."


def _normalise(intent: dict, prompt: str) -> dict:
    out = {
        "venue": (intent.get("venue") or "").strip(),
        "party_size": int(intent.get("party_size") or 2),
        "date": (intent.get("date") or "").strip(),
        "time": (intent.get("time") or "").strip(),
        "name": (intent.get("name") or "").strip(),
        "phone": (intent.get("phone") or "").strip(),
        "notes": (intent.get("notes") or "").strip(),
        "confidence": float(intent.get("confidence") or 0.5),
        "assumptions": intent.get("assumptions") or [],
        "source_prompt": prompt,
    }
    # sanity clamp
    out["party_size"] = max(1, min(out["party_size"], 30))
    return out
