from __future__ import annotations

from decimal import Decimal

import pytest
from hypothesis import given
from hypothesis import strategies as st

from quarry.core.money import CurrencyError, Money


def test_gbp_pence_normalised() -> None:
    m = Money.from_quote("72.40", "GBp")
    assert m.currency == "GBP"
    assert m.amount == Decimal("0.7240")
    assert m.pence is True
    assert m.minor_amount == Decimal("72.40")


@pytest.mark.parametrize("code", ["GBX", "GBx"])
def test_other_pence_codes(code: str) -> None:
    assert Money.from_quote(100, code).amount == Decimal(1)


def test_major_currency_untouched() -> None:
    m = Money.from_quote("189.5", "usd")
    assert (m.amount, m.currency, m.pence) == (Decimal("189.5"), "USD", False)


def test_mixed_currency_addition_rejected() -> None:
    with pytest.raises(CurrencyError):
        Money.from_quote(1, "GBP") + Money.from_quote(1, "USD")


def test_invalid_currency_rejected() -> None:
    with pytest.raises(ValueError, match="ISO-4217"):
        Money(amount=Decimal(1), currency="pounds")


@given(st.decimals(min_value=Decimal("0.0001"), max_value=Decimal("1e9"), places=4))
def test_pence_roundtrip_never_loses_x100(pence: Decimal) -> None:
    m = Money.from_quote(pence, "GBp")
    assert m.minor_amount == pence
    assert m.amount * 100 == pence
