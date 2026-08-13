"""Shared SQLite helpers.

Holdings used to live here as manually-entered rows; they're now *derived* from
paper-trading fills (see trading.py). This module keeps only the connection
helper and the tiny migration utility that every storage module reuses.
"""

import sqlite3
from contextlib import contextmanager

from .config import settings


@contextmanager
def _conn():
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def ensure_column(c, table: str, column: str, decl: str) -> None:
    """Add a column to an existing table if a prior schema lacked it."""
    cols = [r["name"] for r in c.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in cols:
        c.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def init_db() -> None:
    """No base tables of its own anymore; each module owns its schema."""
    return None
