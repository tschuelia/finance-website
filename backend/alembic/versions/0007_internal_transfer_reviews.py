"""Add reviewed internal transfer pairs and analytics indexes."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_internal_transfer_reviews"
down_revision: str | None = "0006_assignment_review"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "finances_internal_transfer_review",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("outgoing_transaction_id", sa.Integer(), nullable=False),
        sa.Column("incoming_transaction_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "outgoing_transaction_id <> incoming_transaction_id",
            name="different_transactions",
        ),
        sa.CheckConstraint(
            "status IN ('confirmed', 'rejected')",
            name="valid_status",
        ),
        sa.ForeignKeyConstraint(
            ["outgoing_transaction_id"],
            ["accounting_transaction.id"],
            deferrable=True,
            initially="DEFERRED",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["incoming_transaction_id"],
            ["accounting_transaction.id"],
            deferrable=True,
            initially="DEFERRED",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_id"],
            ["auth_user.id"],
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    op.create_index(
        "finances_internal_transfer_review_pair_idx",
        "finances_internal_transfer_review",
        ["outgoing_transaction_id", "incoming_transaction_id"],
        unique=True,
    )
    op.create_index(
        "finances_internal_transfer_review_confirmed_outgoing_idx",
        "finances_internal_transfer_review",
        ["outgoing_transaction_id"],
        unique=True,
        sqlite_where=sa.text("status = 'confirmed'"),
    )
    op.create_index(
        "finances_internal_transfer_review_confirmed_incoming_idx",
        "finances_internal_transfer_review",
        ["incoming_transaction_id"],
        unique=True,
        sqlite_where=sa.text("status = 'confirmed'"),
    )
    op.create_index(
        "finances_transaction_account_date_idx",
        "accounting_transaction",
        ["bank_account_id", "date_issue"],
        unique=False,
    )
    op.create_index(
        "finances_transaction_amount_date_account_idx",
        "accounting_transaction",
        ["amount", "date_issue", "bank_account_id"],
        unique=False,
    )


def downgrade() -> None:
    raise RuntimeError("Internal transfer review state must not be removed")
