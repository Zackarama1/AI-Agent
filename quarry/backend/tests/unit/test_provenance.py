from __future__ import annotations

from datetime import UTC, datetime

import pytest

from quarry.core.ids import is_valid_id, new_id
from quarry.core.provenance import LatencyClass, LicenceFlags, Provenance


def test_naive_timestamps_rejected() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        Provenance(
            source="x",
            fetched_at=datetime(2026, 1, 1),  # noqa: DTZ001
            as_of=datetime(2026, 1, 1, tzinfo=UTC),
            latency_class=LatencyClass.EOD,
        )


def test_default_licence_is_personal_and_not_exportable() -> None:
    p = Provenance(
        source="finnhub",
        fetched_at=datetime.now(UTC),
        as_of=datetime.now(UTC),
        latency_class=LatencyClass.REALTIME,
        venue="IEX",
    )
    assert p.licence.personal_only
    assert not p.licence.exportable
    assert LicenceFlags(personal_only=False, redistribution_allowed=True).exportable


def test_ids_are_ulids() -> None:
    a, b = new_id(), new_id()
    assert a != b
    assert is_valid_id(a)
    assert len(a) == 26
    assert not is_valid_id("not-an-id")
