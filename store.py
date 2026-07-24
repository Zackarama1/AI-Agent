"""
Reservation storage — a tiny SQLite layer so bookings survive restarts and can
be shown on a live calendar and exported to iOS/Android via .ics subscription.

Single-file SQLite is right for a local/PoC server. When you go multi-user and
online, swap this module's body for Postgres (the function signatures can stay
the same) — see the deployment notes in the README.
"""

import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data" / "app.db"
_LOCK = threading.Lock()
_CONN: sqlite3.Connection | None = None

STATUSES = ("draft", "pending", "confirmed", "failed", "needs_human", "cancelled")
METHODS = ("agent", "phone", "manual")


def _conn() -> sqlite3.Connection:
    global _CONN
    if _CONN is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _CONN = sqlite3.connect(DB_PATH, check_same_thread=False)
        _CONN.row_factory = sqlite3.Row
        _CONN.execute("""
            CREATE TABLE IF NOT EXISTS reservations (
                id           TEXT PRIMARY KEY,
                created      REAL,
                venue        TEXT,
                start_url    TEXT,
                party_size   INTEGER,
                date         TEXT,   -- YYYY-MM-DD
                time         TEXT,   -- HH:MM (24h)
                name         TEXT,
                phone        TEXT,
                notes        TEXT,
                status       TEXT,
                method       TEXT,
                source_prompt TEXT,
                run_id       TEXT
            )
        """)
        _CONN.commit()
    return _CONN


def _row_to_dict(r: sqlite3.Row) -> dict:
    d = dict(r)
    # convenience: an ISO start datetime for clients/calendars
    if d.get("date") and d.get("time"):
        d["starts_at"] = f"{d['date']}T{d['time']}:00"
    else:
        d["starts_at"] = None
    return d


def create_reservation(data: dict) -> dict:
    rid = uuid.uuid4().hex[:12]
    row = {
        "id": rid,
        "created": time.time(),
        "venue": data.get("venue") or "Untitled venue",
        "start_url": data.get("start_url") or "",
        "party_size": int(data.get("party_size") or 2),
        "date": data.get("date") or "",
        "time": data.get("time") or "",
        "name": data.get("name") or "",
        "phone": data.get("phone") or "",
        "notes": data.get("notes") or "",
        "status": data.get("status") if data.get("status") in STATUSES else "draft",
        "method": data.get("method") if data.get("method") in METHODS else "agent",
        "source_prompt": data.get("source_prompt") or "",
        "run_id": data.get("run_id") or "",
    }
    with _LOCK:
        _conn().execute(
            """INSERT INTO reservations
               (id, created, venue, start_url, party_size, date, time, name, phone,
                notes, status, method, source_prompt, run_id)
               VALUES (:id,:created,:venue,:start_url,:party_size,:date,:time,:name,
                       :phone,:notes,:status,:method,:source_prompt,:run_id)""",
            row,
        )
        _conn().commit()
        r = row_from(rid)
    return _row_to_dict(r)


def row_from(rid: str) -> sqlite3.Row:
    return _conn().execute("SELECT * FROM reservations WHERE id=?", (rid,)).fetchone()


def get_reservation(rid: str) -> dict | None:
    with _LOCK:
        r = row_from(rid)
    return _row_to_dict(r) if r else None


def list_reservations() -> list[dict]:
    with _LOCK:
        rows = _conn().execute(
            "SELECT * FROM reservations ORDER BY date, time, created"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def update_reservation(rid: str, **fields) -> dict | None:
    if not fields:
        return get_reservation(rid)
    cols = ", ".join(f"{k}=:{k}" for k in fields)
    fields["id"] = rid
    with _LOCK:
        _conn().execute(f"UPDATE reservations SET {cols} WHERE id=:id", fields)
        _conn().commit()
        r = row_from(rid)
    return _row_to_dict(r) if r else None


# ---- calendar export (iOS/Android subscribe to this URL) ----

def _ics_dt(date: str, time_str: str) -> str | None:
    try:
        dt = datetime.strptime(f"{date} {time_str}", "%Y-%m-%d %H:%M")
        return dt.strftime("%Y%m%dT%H%M%S")
    except (ValueError, TypeError):
        return None


def to_ics(reservations: list[dict]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Booking Agent//EN",
        "CALSCALE:GREGORIAN",
        "X-WR-CALNAME:Booking Agent",
    ]
    for r in reservations:
        if r.get("status") == "cancelled":
            continue
        start = _ics_dt(r.get("date", ""), r.get("time", ""))
        if not start:
            continue
        end = (datetime.strptime(start, "%Y%m%dT%H%M%S") + timedelta(minutes=90)).strftime(
            "%Y%m%dT%H%M%S"
        )
        summary = f"{r.get('venue', 'Reservation')} (party of {r.get('party_size', '?')})"
        desc = f"Status: {r.get('status')}. Booked via Booking Agent."
        lines += [
            "BEGIN:VEVENT",
            f"UID:{r['id']}@booking-agent",
            f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}",
            f"DTSTART:{start}",
            f"DTEND:{end}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{desc}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
