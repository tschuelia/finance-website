"""Add contract matching terms and assignment review state."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_assignment_review"
down_revision: str | None = "0005_label_estimated_depot_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "accounting_contract",
        sa.Column("patterns", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "accounting_transaction",
        sa.Column("category_reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "accounting_transaction",
        sa.Column("contract_reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        sa.text(
            """
            UPDATE accounting_transaction
            SET category_reviewed = CASE WHEN category_id IS NULL THEN 0 ELSE 1 END,
                contract_reviewed = CASE WHEN contract_id IS NULL THEN 0 ELSE 1 END
            """
        )
    )


def downgrade() -> None:
    raise RuntimeError("Assignment review state must not be removed")
