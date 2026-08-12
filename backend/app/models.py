"""Pydantic request/response shapes shared across the API."""

from pydantic import BaseModel, Field, field_validator

_EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class UserIn(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        import re

        if not re.match(_EMAIL_RE, v.strip()):
            raise ValueError("Invalid email address")
        return v.strip().lower()


class UserOut(BaseModel):
    id: int
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class Quote(BaseModel):
    symbol: str
    price: float
    change: float
    percent_change: float
    high: float
    low: float
    open: float
    prev_close: float
    is_mock: bool = False


class HoldingIn(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=10)
    shares: float = Field(..., gt=0)
    cost_basis: float = Field(..., ge=0, description="Average price paid per share")


class Holding(HoldingIn):
    id: int


class HoldingWithQuote(Holding):
    price: float
    market_value: float
    total_cost: float
    gain: float
    gain_percent: float
    day_change: float
    day_change_percent: float


class PortfolioSummary(BaseModel):
    holdings: list[HoldingWithQuote]
    total_value: float
    total_cost: float
    total_gain: float
    total_gain_percent: float
    day_change: float
    day_change_percent: float


class NewsItem(BaseModel):
    headline: str
    summary: str
    source: str
    url: str
    datetime: int


class Brief(BaseModel):
    text: str
    is_mock: bool = False


class Candle(BaseModel):
    t: int  # epoch seconds
    o: float
    h: float
    l: float
    c: float


class History(BaseModel):
    symbol: str
    candles: list[Candle]
    is_mock: bool = False


class SearchResult(BaseModel):
    symbol: str
    description: str
    type: str = ""


class EarningsEvent(BaseModel):
    symbol: str
    date: str  # YYYY-MM-DD
    hour: str = ""  # "bmo" (before open), "amc" (after close), or ""
    eps_estimate: float | None = None
    eps_actual: float | None = None
    quarter: int | None = None
    year: int | None = None
    is_mock: bool = False


class WatchIn(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=10)


class WatchItem(BaseModel):
    id: int
    symbol: str
    price: float
    change: float
    percent_change: float


class AlertIn(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=10)
    direction: str = Field(..., pattern="^(above|below)$")
    target: float = Field(..., gt=0)


class Alert(AlertIn):
    id: int
    active: bool


class PushToken(BaseModel):
    token: str = Field(..., min_length=1)
