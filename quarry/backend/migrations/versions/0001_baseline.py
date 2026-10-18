"""Phase 0 baseline: reference tables, workspace layouts, command history.

Revision ID: 0001
Revises:
Create Date: 2026-10-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exchange",
        sa.Column("mic", sa.String(4), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
    )
    op.create_table(
        "instrument",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("asset_class", sa.String(16), nullable=False),
        sa.Column("symbol", sa.String(64), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("exchange_mic", sa.String(4), sa.ForeignKey("exchange.mic")),
        sa.Column("country", sa.String(2)),
        sa.Column("currency", sa.String(3)),
        sa.Column("isin", sa.String(12)),
        sa.Column("figi", sa.String(12)),
        sa.Column("lei", sa.String(20)),
        sa.Column("sector", sa.String(100)),
        sa.Column("industry", sa.String(150)),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("metadata", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("symbol", "exchange_mic", name="uq_instrument_symbol_mic"),
    )
    op.create_index("ix_instrument_asset_class", "instrument", ["asset_class"])
    op.create_index("ix_instrument_isin", "instrument", ["isin"])
    op.create_index("ix_instrument_figi", "instrument", ["figi"])
    op.create_table(
        "instrument_alias",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column(
            "instrument_id",
            sa.String(26),
            sa.ForeignKey("instrument.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("symbol", sa.String(64), nullable=False),
        sa.UniqueConstraint("provider", "symbol", name="uq_alias_provider_symbol"),
    )
    op.create_index("ix_instrument_alias_instrument_id", "instrument_alias", ["instrument_id"])
    op.create_table(
        "workspace_layout",
        sa.Column("name", sa.String(64), primary_key=True),
        sa.Column("form_factor", sa.String(16), primary_key=True),
        sa.Column("layout", postgresql.JSONB, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "command_history",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("command", sa.Text, nullable=False),
        sa.Column(
            "executed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_command_history_executed_at", "command_history", ["executed_at"])


def downgrade() -> None:
    op.drop_table("command_history")
    op.drop_table("workspace_layout")
    op.drop_table("instrument_alias")
    op.drop_table("instrument")
    op.drop_table("exchange")
