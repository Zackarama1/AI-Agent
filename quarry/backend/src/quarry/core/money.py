"""Decimal money with explicit currency, and GBp (pence) normalisation.

LSE prices are frequently quoted in pence ("GBp", "GBX"). QUARRY stores GBP and
keeps a `pence` flag so the UI can show either form and nothing is silently x100.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, field_validator

# Minor-unit quote codes seen across providers, mapped to (major currency, divisor).
_MINOR_UNITS: dict[str, tuple[str, Decimal]] = {
    "GBp": ("GBP", Decimal(100)),
    "GBX": ("GBP", Decimal(100)),
    "GBx": ("GBP", Decimal(100)),
    "ZAc": ("ZAR", Decimal(100)),
    "ZAC": ("ZAR", Decimal(100)),
    "ILA": ("ILS", Decimal(100)),
}


class CurrencyError(ValueError):
    pass


class Money(BaseModel):
    model_config = ConfigDict(frozen=True)

    amount: Decimal
    currency: str
    pence: bool = False  # True when the source quoted in minor units

    @field_validator("currency")
    @classmethod
    def _iso(cls, v: str) -> str:
        if len(v) != 3 or not v.isalpha() or not v.isupper():
            raise CurrencyError(f"not a normalised ISO-4217 code: {v!r}")
        return v

    @classmethod
    def from_quote(cls, amount: Decimal | int | str, quote_currency: str) -> Self:
        """Build from a provider's (amount, currency) pair, normalising minor units."""
        value = Decimal(str(amount))
        if quote_currency in _MINOR_UNITS:
            major, divisor = _MINOR_UNITS[quote_currency]
            return cls(amount=value / divisor, currency=major, pence=True)
        return cls(amount=value, currency=quote_currency.upper())

    @property
    def minor_amount(self) -> Decimal:
        """Amount in pence when the source quoted pence (for display), else major units."""
        return self.amount * 100 if self.pence else self.amount

    def __add__(self, other: Money) -> Money:
        if other.currency != self.currency:
            raise CurrencyError(f"cannot add {self.currency} and {other.currency}")
        return Money(amount=self.amount + other.amount, currency=self.currency, pence=self.pence)


def is_minor_unit(code: str) -> bool:
    return code in _MINOR_UNITS
