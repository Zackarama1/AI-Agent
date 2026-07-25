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
                user_id      TEXT,
                created      REAL,
                venue        TEXT,
                start_url    TEXT,
                party_size   INTEGER,
                date         TEXT,   -- YYYY-MM-DD
                time         TEXT,   -- HH:MM (24h)
                name         TEXT,
                email        TEXT,
                phone        TEXT,
                notes        TEXT,
                status       TEXT,
                method       TEXT,
                source_prompt TEXT,
                run_id       TEXT
            )
        """)
        _CONN.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                email         TEXT UNIQUE,
                name          TEXT,
                password_hash TEXT,
                created       REAL
            )
        """)
        _CONN.execute("""
            CREATE TABLE IF NOT EXISTS recommendations (
                id        TEXT PRIMARY KEY,
                venue_id  TEXT,
                venue     TEXT,
                user_id   TEXT,
                author    TEXT,
                rating    INTEGER,
                text      TEXT,
                likes     INTEGER,
                created   REAL
            )
        """)
        _CONN.commit()
    return _CONN


# ---- users ----

def create_user(email: str, name: str, password_hash: str) -> dict:
    uid = uuid.uuid4().hex[:12]
    with _LOCK:
        _conn().execute(
            "INSERT INTO users (id, email, name, password_hash, created) VALUES (?,?,?,?,?)",
            (uid, email.lower().strip(), name.strip(), password_hash, time.time()),
        )
        _conn().commit()
    return {"id": uid, "email": email.lower().strip(), "name": name.strip()}


def get_user_by_email(email: str) -> dict | None:
    with _LOCK:
        r = _conn().execute("SELECT * FROM users WHERE email=?", (email.lower().strip(),)).fetchone()
    return dict(r) if r else None


def get_user(uid: str) -> dict | None:
    with _LOCK:
        r = _conn().execute("SELECT id, email, name, created FROM users WHERE id=?", (uid,)).fetchone()
    return dict(r) if r else None


# ---- recommendations ----

def add_recommendation(data: dict) -> dict:
    rid = uuid.uuid4().hex[:12]
    row = {
        "id": rid, "venue_id": data.get("venue_id", ""), "venue": data.get("venue", ""),
        "user_id": data.get("user_id", ""), "author": data.get("author", "Guest"),
        "rating": int(data.get("rating") or 5), "text": data.get("text", ""),
        "likes": int(data.get("likes") or 0), "created": time.time(),
    }
    with _LOCK:
        _conn().execute(
            """INSERT INTO recommendations (id,venue_id,venue,user_id,author,rating,text,likes,created)
               VALUES (:id,:venue_id,:venue,:user_id,:author,:rating,:text,:likes,:created)""", row)
        _conn().commit()
    return row


def list_recommendations(venue_id: str | None = None, limit: int = 50) -> list[dict]:
    with _LOCK:
        if venue_id:
            rows = _conn().execute(
                "SELECT * FROM recommendations WHERE venue_id=? ORDER BY created DESC LIMIT ?",
                (venue_id, limit)).fetchall()
        else:
            rows = _conn().execute(
                "SELECT * FROM recommendations ORDER BY created DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


def like_recommendation(rid: str) -> dict | None:
    with _LOCK:
        _conn().execute("UPDATE recommendations SET likes = likes + 1 WHERE id=?", (rid,))
        _conn().commit()
        r = _conn().execute("SELECT * FROM recommendations WHERE id=?", (rid,)).fetchone()
    return dict(r) if r else None


def recommendations_count() -> int:
    with _LOCK:
        return _conn().execute("SELECT COUNT(*) FROM recommendations").fetchone()[0]


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
        "user_id": data.get("user_id") or "",
        "created": time.time(),
        "venue": data.get("venue") or "Untitled venue",
        "start_url": data.get("start_url") or "",
        "party_size": int(data.get("party_size") or 2),
        "date": data.get("date") or "",
        "time": data.get("time") or "",
        "name": data.get("name") or "",
        "email": data.get("email") or "",
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
               (id, user_id, created, venue, start_url, party_size, date, time, name, email, phone,
                notes, status, method, source_prompt, run_id)
               VALUES (:id,:user_id,:created,:venue,:start_url,:party_size,:date,:time,:name,:email,
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


def list_reservations(user_id: str | None = None) -> list[dict]:
    with _LOCK:
        if user_id:
            rows = _conn().execute(
                "SELECT * FROM reservations WHERE user_id=? ORDER BY date, time, created",
                (user_id,)).fetchall()
        else:
            rows = _conn().execute(
                "SELECT * FROM reservations ORDER BY date, time, created").fetchall()
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
