"""Provider abstraction: capability manifests and the Protocols adapters implement.

Phase 0 fixes the contracts; concrete adapters arrive in Phase 1+. Adapters never
leak vendor shapes past this layer: they return canonical models stamped with
`Provenance`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field

from quarry.core.provenance import LatencyClass, LicenceFlags, Provenance


class AssetClass(StrEnum):
    EQUITY = "equity"
    ETF = "etf"
    INDEX = "index"
    FX = "fx"
    CRYPTO = "crypto"
    COMMODITY = "commodity"
    RATES = "rates"
    BOND = "bond"
    OPTION = "option"
    FUTURE = "future"
    MACRO = "macro"
    NEWS = "news"
    FILINGS = "filings"
    REFERENCE = "reference"


class CostTier(StrEnum):
    FREE = "free"
    PAID = "paid"


class RateWindow(BaseModel):
    model_config = ConfigDict(frozen=True)

    requests: int = Field(gt=0)
    seconds: int = Field(gt=0)
    soft: bool = False  # observed rather than published; back off on 429


class CapabilityManifest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    display_name: str
    enabled: bool = True
    cost_tier: CostTier = CostTier.FREE
    monthly_cost_usd: Decimal = Decimal(0)
    key_fields: tuple[str, ...] = ()  # Settings fields that must be set
    asset_classes: tuple[AssetClass, ...]
    exchanges: tuple[str, ...] = ()  # ISO 10383 MICs; empty = n/a or global
    latency_class: LatencyClass
    venue: str | None = None
    rate_limits: tuple[RateWindow, ...] = ()
    ws_symbol_cap: int | None = None
    history: str | None = None
    licence: LicenceFlags
    docs_url: str | None = None
    last_verified: date | None = None
    notes: str | None = None

    @property
    def daily_limit(self) -> int | None:
        daily = [w.requests for w in self.rate_limits if w.seconds == 86_400]
        return min(daily) if daily else None


# ---- canonical records (minimal Phase 0 set; extended per phase) -------------


class Quote(BaseModel):
    model_config = ConfigDict(frozen=True)

    instrument_id: str
    last: Decimal | None = None
    bid: Decimal | None = None
    ask: Decimal | None = None
    volume: Decimal | None = None
    currency: str
    pence: bool = False
    provenance: Provenance


class Bar(BaseModel):
    model_config = ConfigDict(frozen=True)

    instrument_id: str
    ts: datetime
    interval: str
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal | None = None
    adjusted: bool = False
    provenance: Provenance


class InstrumentMatch(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    name: str
    exchange_mic: str | None
    asset_class: AssetClass
    currency: str | None
    isin: str | None = None
    figi: str | None = None


# ---- protocols ---------------------------------------------------------------


@runtime_checkable
class Provider(Protocol):
    manifest: CapabilityManifest

    async def healthcheck(self) -> bool: ...


@runtime_checkable
class QuoteProvider(Provider, Protocol):
    async def snapshot(self, symbols: Sequence[str]) -> list[Quote]: ...

    def stream(self, symbols: Sequence[str]) -> AsyncIterator[Quote]: ...


@runtime_checkable
class BarsProvider(Provider, Protocol):
    async def bars(
        self, symbol: str, interval: str, start: datetime, end: datetime
    ) -> list[Bar]: ...


@runtime_checkable
class ReferenceDataProvider(Provider, Protocol):
    async def search(self, query: str, limit: int = 20) -> list[InstrumentMatch]: ...
