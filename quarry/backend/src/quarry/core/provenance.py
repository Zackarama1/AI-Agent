"""Provenance and licence types stamped on every record QUARRY stores or shows."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, field_validator


class LatencyClass(StrEnum):
    REALTIME = "realtime"
    DELAYED_15M = "delayed_15m"
    EOD = "eod"
    INDICATIVE = "indicative"


class LicenceFlags(BaseModel):
    model_config = ConfigDict(frozen=True)

    personal_only: bool = True
    display_allowed: bool = True
    redistribution_allowed: bool = False
    attribution_text: str | None = None

    @property
    def exportable(self) -> bool:
        """Whether data under this licence may leave the app (export guard)."""
        return self.redistribution_allowed and not self.personal_only


class Provenance(BaseModel):
    model_config = ConfigDict(frozen=True)

    source: str
    source_record_id: str | None = None
    fetched_at: datetime
    as_of: datetime
    latency_class: LatencyClass
    venue: str | None = None  # e.g. "IEX": a single venue, not consolidated
    licence: LicenceFlags = LicenceFlags()

    @field_validator("fetched_at", "as_of")
    @classmethod
    def _must_be_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None or v.utcoffset() is None:
            raise ValueError("timestamps must be timezone-aware (store UTC)")
        return v
