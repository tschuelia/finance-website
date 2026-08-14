"""Add manually recorded depot balance snapshots."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_depot_balance_snapshots"
down_revision: str | None = "0002_server_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "finances_depot_balance_snapshot",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("bank_depot_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("balance", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["bank_depot_id"],
            ["accounting_bankdepot.id"],
            deferrable=True,
            initially="DEFERRED",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "finances_depot_balance_snapshot_depot_date_idx",
        "finances_depot_balance_snapshot",
        ["bank_depot_id", "date"],
        unique=True,
    )

    depot_asset = sa.table(
        "accounting_depotasset",
        sa.column("bank_depot_id", sa.Integer()),
        sa.column("current_balance", sa.Numeric(precision=10, scale=2)),
        sa.column("last_update", sa.Date()),
    )
    depot_snapshot = sa.table(
        "finances_depot_balance_snapshot",
        sa.column("bank_depot_id", sa.Integer()),
        sa.column("date", sa.Date()),
        sa.column("balance", sa.Numeric(precision=10, scale=2)),
    )
    op.execute(
        sa.insert(depot_snapshot).from_select(
            ["bank_depot_id", "date", "balance"],
            sa.select(
                depot_asset.c.bank_depot_id,
                sa.func.max(depot_asset.c.last_update),
                sa.func.sum(depot_asset.c.current_balance),
            )
            .where(depot_asset.c.bank_depot_id.is_not(None))
            .group_by(depot_asset.c.bank_depot_id),
        )
    )


def downgrade() -> None:
    op.drop_index(
        "finances_depot_balance_snapshot_depot_date_idx",
        table_name="finances_depot_balance_snapshot",
    )
    op.drop_table("finances_depot_balance_snapshot")
