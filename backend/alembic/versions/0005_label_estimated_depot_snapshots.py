"""Label depot snapshots that combine balances from different effective dates."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_label_estimated_depot_snapshots"
down_revision: str | None = "0004_depot_asset_balance_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "finances_depot_balance_snapshot",
        sa.Column(
            "is_estimated",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE finances_depot_balance_snapshot AS snapshot
            SET is_estimated = 1
            WHERE EXISTS (
                SELECT 1
                FROM accounting_depotasset AS asset
                WHERE asset.bank_depot_id = snapshot.bank_depot_id
                  AND asset.last_update != snapshot.date
            )
            """
        )
    )


def downgrade() -> None:
    raise RuntimeError("Estimated depot snapshot provenance must not be removed")
