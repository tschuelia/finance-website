"""Add server-side sessions."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_server_sessions"
down_revision: str | None = "0001_legacy_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "finances_session",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("csrf_token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["auth_user.id"],
            deferrable=True,
            initially="DEFERRED",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("finances_session_user_id_idx", "finances_session", ["user_id"])
    op.create_index("finances_session_expires_at_idx", "finances_session", ["expires_at"])


def downgrade() -> None:
    op.drop_index("finances_session_expires_at_idx", table_name="finances_session")
    op.drop_index("finances_session_user_id_idx", table_name="finances_session")
    op.drop_table("finances_session")
