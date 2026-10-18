"""SQLAlchemy ORM models (Phase 0 subset of the canonical data model)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from quarry.core.ids import new_id

JSONType = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Exchange(Base):
    __tablename__ = "exchange"

    mic: Mapped[str] = mapped_column(String(4), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    country: Mapped[str] = mapped_column(String(2))
    timezone: Mapped[str] = mapped_column(String(64))
    currency: Mapped[str] = mapped_column(String(3))


class Instrument(TimestampMixin, Base):
    __tablename__ = "instrument"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    asset_class: Mapped[str] = mapped_column(String(16), index=True)
    symbol: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(300))
    exchange_mic: Mapped[str | None] = mapped_column(ForeignKey("exchange.mic"))
    country: Mapped[str | None] = mapped_column(String(2))
    currency: Mapped[str | None] = mapped_column(String(3))
    isin: Mapped[str | None] = mapped_column(String(12), index=True)
    figi: Mapped[str | None] = mapped_column(String(12), index=True)
    lei: Mapped[str | None] = mapped_column(String(20))
    sector: Mapped[str | None] = mapped_column(String(100))
    industry: Mapped[str | None] = mapped_column(String(150))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONType, default=dict)

    aliases: Mapped[list[InstrumentAlias]] = relationship(
        back_populates="instrument", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("symbol", "exchange_mic", name="uq_instrument_symbol_mic"),)


class InstrumentAlias(Base):
    """Provider-specific symbology, e.g. VOD.L (Twelve Data) / VOD.LSE (EODHD)."""

    __tablename__ = "instrument_alias"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    instrument_id: Mapped[str] = mapped_column(
        ForeignKey("instrument.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32))
    symbol: Mapped[str] = mapped_column(String(64))

    instrument: Mapped[Instrument] = relationship(back_populates="aliases")

    __table_args__ = (UniqueConstraint("provider", "symbol", name="uq_alias_provider_symbol"),)


class WorkspaceLayout(TimestampMixin, Base):
    __tablename__ = "workspace_layout"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    # "desktop" (dockview JSON) or "tablet" (pane assignments); layouts differ by form factor.
    form_factor: Mapped[str] = mapped_column(String(16), primary_key=True, default="desktop")
    layout: Mapped[dict[str, Any]] = mapped_column(JSONType)


class CommandHistory(Base):
    __tablename__ = "command_history"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    command: Mapped[str] = mapped_column(Text)
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("ix_command_history_executed_at", "executed_at"),)
