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
    session = BrowserSession(headed=False)
    yield {"type": "status", "message": f"Starting browser ({mode} mode)…"}
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


# ---- dry run: scripted, no model, proves the browser + UI pipeline ----

_ELEMENT_RE = re.compile(r"\[(\d+)\]\s*<(\w+)>")


def _parse_elements(read_output: str):
    """Pull (id, tag) pairs out of read_page()'s element listing."""
    inputs, buttons = [], []
    for eid, tag in _ELEMENT_RE.findall(read_output):
        if tag in ("input", "textarea"):
            inputs.append(eid)
        elif tag == "button":
            buttons.append(eid)
    return inputs, buttons


_CONFIRM_WORDS = ("subscribed", "thank", "success", "confirmed", "you're in", "welcome")


async def _run_dry(session: BrowserSession, task: dict) -> AsyncIterator[dict]:
    yield {
        "type": "assistant",
        "text": ("Dry run (no model call): I'll navigate, read the page, fill the "
                 "first text fields, submit, and check for a confirmation."),
    }

    r = await session.navigate(task["start_url"])
    yield {"type": "action", "tool": "navigate", "input": {"url": task["start_url"]},
           "result": r, "step": 1}

    page = await session.read_page()
    yield {"type": "action", "tool": "read_page", "input": {}, "result": _short(page), "step": 2}

    inputs, buttons = _parse_elements(page)
    values = ["Test User", "test-agent@example.com"]
    step = 3
    for eid, val in zip(inputs[:2], values):
        r = await session.fill(eid, val)
        yield {"type": "action", "tool": "fill", "input": {"element_id": eid, "text": val},
               "result": r, "step": step}
        step += 1

    if buttons:
        r = await session.click(buttons[0])
        yield {"type": "action", "tool": "click", "input": {"element_id": buttons[0]},
               "result": r, "step": step}
        step += 1

    page2 = await session.read_page()
    yield {"type": "action", "tool": "read_page", "input": {}, "result": _short(page2), "step": step}

    ok = any(w in page2.lower() for w in _CONFIRM_WORDS)
    yield {
        "type": "result",
        "outcome": "success" if ok else "needs_human",
        "note": ("Confirmation text found on the page." if ok
                 else "No confirmation detected — a human should verify."),
        "steps": step,
    }
