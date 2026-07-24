"""
In-memory run store for the server.

A Job is one execution of a task. It buffers every event the agent emits so a
mobile client that connects late (or reconnects after the screen locked) still
sees the whole story, and it fans new events out to any live SSE subscribers.

This is deliberately in-memory / single-process — fine for a local dev server
and the PoC. Swap for Redis + a task queue when you outgrow one machine.
"""

import asyncio
import time
import uuid


class Job:
    def __init__(self, task: dict, mode: str):
        self.id = uuid.uuid4().hex[:12]
        self.task = task
        self.mode = mode
        self.status = "queued"          # queued | running | done | error
        self.outcome: str | None = None  # success | failed | needs_human
        self.note: str | None = None
        self.steps = 0
        self.created = time.time()

        self.events: list[dict] = []          # full history, replayed on subscribe
        self._subscribers: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()
        self.finished = asyncio.Event()

    async def emit(self, event: dict) -> None:
        async with self._lock:
            self.events.append(event)
            for q in self._subscribers:
                q.put_nowait(event)

    async def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            for past in self.events:   # replay history first
                q.put_nowait(past)
            self._subscribers.add(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue) -> None:
        async with self._lock:
            self._subscribers.discard(q)

    def summary(self) -> dict:
        return {
            "id": self.id,
            "mode": self.mode,
            "status": self.status,
            "outcome": self.outcome,
            "note": self.note,
            "steps": self.steps,
            "created": self.created,
        }


JOBS: dict[str, Job] = {}
