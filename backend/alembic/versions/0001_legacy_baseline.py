"""Create the legacy-compatible user and domain schema."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001_legacy_baseline"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _legacy_foreign_key(target: str) -> sa.ForeignKey:
    return sa.ForeignKey(target, deferrable=True, initially="DEFERRED")


def upgrade() -> None:
    op.create_table(
        "auth_user",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("password", sa.String(length=128), nullable=False),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        sa.Column("is_superuser", sa.Boolean(), nullable=False),
        sa.Column("username", sa.String(length=150), nullable=False),
        sa.Column("last_name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("is_staff", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("date_joined", sa.DateTime(), nullable=False),
        sa.Column("first_name", sa.String(length=150), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_table(
        "accounting_category",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("patterns", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "accounting_bankaccount",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("bank", sa.String(length=255), nullable=False),
        sa.Column("current_amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "owner_id",
            sa.Integer(),
            _legacy_foreign_key("auth_user.id"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "accounting_bankaccount_owner_id_a451fc73",
        "accounting_bankaccount",
        ["owner_id"],
    )
    op.create_table(
        "accounting_bankdepot",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "owner_id",
            sa.Integer(),
            _legacy_foreign_key("auth_user.id"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "accounting_bankdepot_owner_id_b63f67ab",
        "accounting_bankdepot",
        ["owner_id"],
    )
    op.create_table(
        "accounting_contract",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "owner_id",
            sa.Integer(),
            _legacy_foreign_key("auth_user.id"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "accounting_contract_owner_id_f118a281",
        "accounting_contract",
        ["owner_id"],
    )
    op.create_table(
        "accounting_depotasset",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("current_balance", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "bank_depot_id",
            sa.BigInteger(),
            _legacy_foreign_key("accounting_bankdepot.id"),
            nullable=True,
        ),
        sa.Column("last_update", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "accounting_depotasset_bank_depot_id_167d5621",
        "accounting_depotasset",
        ["bank_depot_id"],
    )
    op.create_table(
        "accounting_contractfile",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("file", sa.String(length=100), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column(
            "contract_id",
            sa.BigInteger(),
            _legacy_foreign_key("accounting_contract.id"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "accounting_contractfile_contract_id_b8a6335e",
        "accounting_contractfile",
        ["contract_id"],
    )
    op.create_table(
        "accounting_depotassettransaction",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("date_issue", sa.Date(), nullable=False),
        sa.Column(
            "asset_id",
            sa.BigInteger(),
            _legacy_foreign_key("accounting_depotasset.id"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "accounting_depotassettransaction_asset_id_fd10fa10",
        "accounting_depotassettransaction",
        ["asset_id"],
    )
    op.create_table(
        "accounting_transaction",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("recipient", sa.String(length=255), nullable=False),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("subject", sa.String(length=1024), nullable=False),
        sa.Column("date_issue", sa.Date(), nullable=False),
        sa.Column("date_booking", sa.Date(), nullable=True),
        sa.Column("full_subject_string", sa.Text(), nullable=False),
        sa.Column(
            "bank_account_id",
            sa.BigInteger(),
            _legacy_foreign_key("accounting_bankaccount.id"),
            nullable=True,
        ),
        sa.Column(
            "category_id",
            sa.BigInteger(),
            _legacy_foreign_key("accounting_category.id"),
            nullable=True,
        ),
        sa.Column(
            "contract_id",
            sa.BigInteger(),
            _legacy_foreign_key("accounting_contract.id"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "accounting_transaction_bank_account_id_903676bb",
        "accounting_transaction",
        ["bank_account_id"],
    )
    op.create_index(
        "accounting_transaction_category_id_3bec2add",
        "accounting_transaction",
        ["category_id"],
    )
    op.create_index(
        "accounting_transaction_contract_id_be87a27f",
        "accounting_transaction",
        ["contract_id"],
    )


def downgrade() -> None:
    raise RuntimeError(
        "The legacy baseline is protected and cannot drop preserved user or domain tables"
    )
