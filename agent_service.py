"""
Async agent runner for the server.

Same idea as agent.py's loop, but instead of only printing a result at the end
it *yields* a structured event for every step, so a UI can show progress live.

Two modes:
  - "real":    drives Claude with the browser tools (needs ANTHROPIC_API_KEY).
  - "dry_run": a scripted walkthrough (navigate -> read -> fill -> submit) using
               the real browser tools but no model call. Lets you see the whole
               pipeline and the mobile UI working with no key and no cost.

Event shapes (all dicts, JSON-serialisable):
  {"type": "status",    "message": str}
  {"type": "assistant", "text": str}                         # model's words
  {"type": "action",    "tool": str, "input": dict,
                         "result": str, "step": int}         # a tool call
  {"type": "result",    "outcome": str, "note": str, "steps": int}
  {"type": "error",     "message": str}
"""

import asyncio
import os
import re
from datetime import datetime, timedelta
from typing import AsyncIterator

from browser_tools import BrowserSession, TOOL_DEFINITIONS, execute_tool


def _short(s: str, n: int = 600) -> str:
    s = s or ""
    return s if len(s) <= n else s[:n] + " …[truncated]"


def _resolve_url(url: str) -> str:
    """Allow task start_urls like '/demo/form' to point at this local server."""
    if url.startswith("/"):
        port = os.getenv("PORT", "8000")
        return f"http://127.0.0.1:{port}{url}"
    return url


async def run_task_events(task: dict, mode: str = "dry_run") -> AsyncIterator[dict]:
    task = {**task, "start_url": _resolve_url(task["start_url"])}
    from browser_tools import browserbase_connect_url
    where = "hosted browser" if browserbase_connect_url() else "local browser"
    session = BrowserSession(headed=False)
    yield {"type": "status", "message": f"Starting {where} ({mode} mode)…"}
    await session.start()
    try:
        if mode == "real":
            async for ev in _run_real(session, task):
                yield ev
        else:
            async for ev in _run_dry(session, task):
                yield ev
    finally:
        await session.stop()


# ---- real mode: the Claude-driven loop (single source of truth from agent.py) ----

async def _run_real(session: BrowserSession, task: dict) -> AsyncIterator[dict]:
    from anthropic import Anthropic
    from agent import SYSTEM_PROMPT, MODEL, MAX_STEPS

    client = Anthropic()
    messages = [{
        "role": "user",
        "content": (
            f"Task: {task['instruction']}\n"
            f"Starting URL: {task['start_url']}\n\n"
            "Begin by navigating to the starting URL."
        ),
    }]

    for step in range(MAX_STEPS):
        # The Anthropic SDK call is blocking; keep the event loop free.
        response = await asyncio.to_thread(
            client.messages.create,
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,
            messages=messages,
        )
        messages.append({"role": "assistant", "content": response.content})

        text = " ".join(b.text for b in response.content if b.type == "text").strip()
        if text:
            yield {"type": "assistant", "text": text}

        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if not tool_uses:
            messages.append({
                "role": "user",
                "content": "Please continue using tools, or call task_complete.",
            })
            continue

        tool_results = []
        for tu in tool_uses:
            if tu.name == "task_complete":
                yield {
                    "type": "result",
                    "outcome": tu.input.get("outcome", "failed"),
                    "note": tu.input.get("note", ""),
                    "steps": step + 1,
                }
                return
            output = await execute_tool(session, tu.name, tu.input)
            yield {
                "type": "action",
                "tool": tu.name,
                "input": tu.input,
                "result": _short(output),
                "step": step + 1,
            }
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": output,
            })
        messages.append({"role": "user", "content": tool_results})

    yield {"type": "result", "outcome": "failed", "note": "hit max step limit", "steps": MAX_STEPS}


# ---- dry run: scripted multi-step form filler, no model ----
#
# A generic loop that reads the page, fills text inputs, sets dropdowns, and
# clicks the most sensible button — repeating so it can walk multi-step flows
# (party/date/time -> availability -> guest details -> confirm). Proves the
# whole browser + tool + UI pipeline against a realistic form, with no API key.

_ELEMENT_RE = re.compile(r"^\[(\d+)\]\s+<(\w+)>\s*(.*)$", re.M)
_OPTIONS_RE = re.compile(r"options:\s*\[(.*)\]\s*$")
_TIME_RE = re.compile(r"\b\d{1,2}:\d{2}\s*(?:am|pm)\b", re.I)

# Specific success phrases — must appear ONLY on a completed booking/signup,
# not in disclaimers or button labels (e.g. "nothing is reserved", "Confirm").
_CONFIRM_WORDS = ("subscribed", "reservation confirmed", "booking confirmed",
                  "you're all set", "you are all set")
_PRIMARY_WORDS = ("check availability", "continue", "next", "find a table", "search")
_SUBMIT_WORDS = ("confirm", "reserve", "book", "subscribe", "submit", "place")
_AVOID_WORDS = ("back", "cancel", "close", "sign in", "log in", "login")


def _parse_full(read_output: str) -> list[dict]:
    els = []
    for eid, tag, rest in _ELEMENT_RE.findall(read_output):
        options = []
        label = rest.strip()
        m = _OPTIONS_RE.search(rest)
        if m:
            options = [o.strip() for o in m.group(1).split("|") if o.strip()]
            label = rest[: m.start()].strip()
        els.append({"id": eid, "tag": tag, "label": label, "options": options})
    return els


def _pick_option(el: dict, time_hint: str) -> str | None:
    opts = [o for o in el["options"] if o and not o.lower().startswith("select")]
    if not opts:
        return None
    joined = " ".join(opts).lower()
    if "guest" in joined or "party" in joined:            # party size
        return next((o for o in opts if o.strip().startswith("2")), opts[0])
    if _TIME_RE.search(joined):                            # time picker
        return next((o for o in opts if _norm(o) == _norm(time_hint)), None) or \
               next((o for o in opts if o.strip().startswith("7:")), opts[0])
    return opts[0]


def _value_for(label: str, vals: dict) -> str | None:
    l = label.lower()
    if "email" in l:
        return "test-agent@example.com"
    if "phone" in l or "mobile" in l or "tel" in l:
        return vals.get("phone") or "555-0100"
    if "name" in l:
        return vals.get("name") or "Test Guest"
    if "date" in l:
        return (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
    return None  # leave notes / unknown fields blank


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", (s or "").lower())


async def _run_dry(session: BrowserSession, task: dict) -> AsyncIterator[dict]:
    time_hint = task.get("time_hint") or _time_hint_from_task(task)
    guest = task.get("guest") or {}
    yield {"type": "assistant",
           "text": ("Dry run (no model call): I'll walk the form step by step — set the "
                    "dropdowns, fill the details, pick an available slot, and confirm.")}

    step = 1
    r = await session.navigate(task["start_url"])
    yield {"type": "action", "tool": "navigate", "input": {"url": task["start_url"]}, "result": r, "step": step}

    done_selects, done_text, clicked, slot_chosen = set(), set(), set(), False
    confirmed = False

    for _ in range(8):
        step += 1
        page = await session.read_page()
        yield {"type": "action", "tool": "read_page", "input": {}, "result": _short(page), "step": step}
        if any(w in page.lower() for w in _CONFIRM_WORDS):
            confirmed = True
            break

        els = _parse_full(page)
        acted = False

        # 1) dropdowns (only ones on screen now)
        for e in els:
            sig = e["label"] + "|" + "|".join(e["options"])
            if e["tag"] != "select" or sig in done_selects:
                continue
            if not await _visible(session, e["id"]):
                continue
            opt = _pick_option(e, time_hint)
            if not opt:
                continue
            try:
                step += 1
                r = await session.select_option(e["id"], opt)
                yield {"type": "action", "tool": "select_option",
                       "input": {"element_id": e["id"], "option": opt}, "result": r, "step": step}
                done_selects.add(sig); acted = True
            except Exception:
                pass

        # 2) text / date inputs — skip anything not visible yet (revealed later)
        for e in els:
            if e["tag"] not in ("input", "textarea") or e["label"] in done_text:
                continue
            val = _value_for(e["label"], guest)
            if not val or not await _visible(session, e["id"]):
                continue
            try:
                step += 1
                r = await session.fill(e["id"], val)
                yield {"type": "action", "tool": "fill",
                       "input": {"element_id": e["id"], "text": val}, "result": r, "step": step}
                done_text.add(e["label"]); acted = True
            except Exception:
                pass

        # 3) one button per round (must be visible + enabled)
        btn, is_slot = await _pick_button(session, els, clicked, slot_chosen, time_hint)
        if btn:
            try:
                step += 1
                r = await session.click(btn["id"])
                yield {"type": "action", "tool": "click",
                       "input": {"element_id": btn["id"]}, "result": r, "step": step}
                clicked.add(_norm(btn["label"]))
                if is_slot:
                    slot_chosen = True
                acted = True
            except Exception:
                pass

        if not acted:
            break

    yield {
        "type": "result",
        "outcome": "success" if confirmed else "needs_human",
        "note": ("Reservation confirmed on the page." if confirmed
                 else "Walked the form but saw no confirmation — a human should verify."),
        "steps": step,
    }


async def _visible(session: BrowserSession, eid: str) -> bool:
    try:
        return await session.page.locator(f"[data-agent-id='{eid}']").is_visible()
    except Exception:
        return False


async def _clickable(session: BrowserSession, eid: str) -> bool:
    try:
        loc = session.page.locator(f"[data-agent-id='{eid}']")
        return await loc.is_visible() and await loc.is_enabled()
    except Exception:
        return False


async def _pick_button(session, els: list[dict], clicked: set, slot_chosen: bool, time_hint: str):
    buttons = [e for e in els if e["tag"] in ("button", "a")]

    async def ok(b):
        if _norm(b["label"]) in clicked or any(w in b["label"].lower() for w in _AVOID_WORDS):
            return False
        return await _clickable(session, b["id"])

    # primary progression button (e.g. "Check availability")
    for b in buttons:
        if any(w in b["label"].lower() for w in _PRIMARY_WORDS) and await ok(b):
            return b, False
    # an available (enabled) time-slot chip — prefer the requested time
    if not slot_chosen:
        slots = [b for b in buttons if _TIME_RE.search(b["label"])]
        for b in slots:  # first pass: exact requested time
            if _norm(b["label"]) == _norm(time_hint) and await ok(b):
                return b, True
        for b in slots:  # otherwise the closest enabled slot
            if await ok(b):
                return b, True
    # final submit
    for b in buttons:
        if any(w in b["label"].lower() for w in _SUBMIT_WORDS) and await ok(b):
            return b, False
    return None, False


def _time_hint_from_task(task: dict) -> str:
    """Best-effort time like '7:00 PM' out of the instruction, else default."""
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", task.get("instruction", ""), re.I)
    if m:
        return f"{int(m.group(1))}:{m.group(2) or '00'} {m.group(3).upper()}"
    m = re.search(r"\b(\d{1,2}):(\d{2})\b", task.get("instruction", ""))
    if m:
        h = int(m.group(1)); ap = "PM" if h >= 12 else "AM"; h = ((h + 11) % 12) + 1
        return f"{h}:{m.group(2)} {ap}"
    return "7:00 PM"
