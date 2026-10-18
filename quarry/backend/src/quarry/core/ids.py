"""Internal identifiers: ULIDs (sortable, provider-agnostic)."""

from __future__ import annotations

from ulid import ULID


def new_id() -> str:
    return str(ULID())


def is_valid_id(value: str) -> bool:
    try:
        ULID.from_str(value)
    except ValueError:
        return False
    return True
