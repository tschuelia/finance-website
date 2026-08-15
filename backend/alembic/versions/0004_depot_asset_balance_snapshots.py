"""Add manually recorded depot asset balance snapshots."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_depot_asset_balance_snapshots"
down_revision: str | None = "0003_depot_balance_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "finances_depot_asset_balance_snapshot",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("asset_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("balance", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["accounting_depotasset.id"],
            deferrable=True,
            initially="DEFERRED",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "finances_depot_asset_balance_snapshot_asset_date_idx",
        "finances_depot_asset_balance_snapshot",
        ["asset_id", "date"],
        unique=True,
    )

    depot_asset = sa.table(
        "accounting_depotasset",
        sa.column("id", sa.Integer()),
        sa.column("current_balance", sa.Numeric(precision=10, scale=2)),
        sa.column("last_update", sa.Date()),
    )
    asset_snapshot = sa.table(
        "finances_depot_asset_balance_snapshot",
        sa.column("asset_id", sa.Integer()),
        sa.column("date", sa.Date()),
        sa.column("balance", sa.Numeric(precision=10, scale=2)),
    )
    op.execute(
        sa.insert(asset_snapshot).from_select(
            ["asset_id", "date", "balance"],
            sa.select(
                depot_asset.c.id,
                depot_asset.c.last_update,
                depot_asset.c.current_balance,
            ),
        )
    )


def downgrade() -> None:
    op.drop_index(
        "finances_depot_asset_balance_snapshot_asset_date_idx",
        table_name="finances_depot_asset_balance_snapshot",
    )
    op.drop_table("finances_depot_asset_balance_snapshot")
