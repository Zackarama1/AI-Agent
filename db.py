"""
Tiny DB abstraction so store.py works on both SQLite (default, local/PoC) and
Postgres (production) with no query rewrites.

Pick the backend with DATABASE_URL:
  - unset            -> SQLite at data/app.db
  - postgres://...   -> Postgres via psycopg 3

Both connections expose the same `.execute(sql, params).fetch*()` / `.commit()`
surface. A connection proxy rewrites SQLite-style placeholders (`?` and
`:name`) and the `REAL` type to their Postgres equivalents on the fly, so the
rest of the code is written once, SQLite-style.
"""

import os
import re
import threading
from pathlib import Path

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
IS_PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))

_LOCK = threading.Lock()
_RAW = None


def backend() -> str:
    return "postgres" if IS_PG else "sqlite"


def translate(query: str) -> str:
    """SQLite SQL -> Postgres SQL (placeholders + REAL), comment-safe."""
    if not IS_PG:
        return query
    out = []
    for line in query.split("\n"):
        code, sep, comment = line.partition("--")   # never touch -- comments
        code = code.replace("?", "%s")
        code = re.sub(r":(\w+)", r"%(\1)s", code)
        code = re.sub(r"\bREAL\b", "DOUBLE PRECISION", code)
        out.append(code + sep + comment)
    return "\n".join(out)


class _Conn:
    """Uniform wrapper; auto-translates SQL for the active backend."""
    def __init__(self, raw):
        self._raw = raw

    def execute(self, query, params=()):
        return self._raw.execute(translate(query), params)

    def commit(self):
        self._raw.commit()


def get_conn() -> _Conn:
    global _RAW
    if _RAW is None:
        if IS_PG:
            import psycopg
            from psycopg.rows import dict_row
            # Pin UTF-8 so text always decodes to str (managed Postgres is UTF-8;
            # this also makes a mis-encoded local cluster behave).
            _RAW = psycopg.connect(DATABASE_URL, row_factory=dict_row,
                                   autocommit=False, client_encoding="UTF8")
        else:
            import sqlite3
            path = Path(__file__).resolve().parent / "data" / "app.db"
            path.parent.mkdir(parents=True, exist_ok=True)
            _RAW = sqlite3.connect(path, check_same_thread=False)
            _RAW.row_factory = sqlite3.Row
    return _Conn(_RAW)
