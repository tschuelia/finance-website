import sqlite3
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Never

import typer
from alembic.util import CommandError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.cli import management
from app.config import ConfigurationError, load_settings
from app.db.engine import create_database_engine, create_session_factory, session_scope
from app.db.migrations import (
    DatabaseMigrationError,
    bootstrap_existing_database,
    database_status,
    upgrade_database,
)
from app.db.schema import DatabaseInspection, inspect_database
from app.services.contracts import delete_orphaned_contract_files, reconcile_contract_files

app = typer.Typer(help="Finances management commands.", no_args_is_help=True)
db_app = typer.Typer(help="Inspect and migrate the finances database.", no_args_is_help=True)
users_app = typer.Typer(help="Manage application users.", no_args_is_help=True)
sessions_app = typer.Typer(help="Manage authenticated sessions.", no_args_is_help=True)
accounts_app = typer.Typer(help="Manage bank accounts.", no_args_is_help=True)
depots_app = typer.Typer(help="Manage bank depots.", no_args_is_help=True)
assets_app = typer.Typer(help="Manage depot assets.", no_args_is_help=True)
asset_transactions_app = typer.Typer(help="Manage depot asset transactions.", no_args_is_help=True)
contract_files_app = typer.Typer(help="Inspect stored contract files.", no_args_is_help=True)
app.add_typer(db_app, name="db")
app.add_typer(users_app, name="users")
app.add_typer(sessions_app, name="sessions")
app.add_typer(accounts_app, name="accounts")
app.add_typer(depots_app, name="depots")
app.add_typer(assets_app, name="assets")
app.add_typer(asset_transactions_app, name="asset-transactions")
app.add_typer(contract_files_app, name="contract-files")


def _database_path() -> Path:
    try:
        return load_settings().database_path
    except ConfigurationError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(code=2) from None


def _print_inspection(inspection: DatabaseInspection) -> None:
    typer.echo(f"Schema compatible: {'yes' if inspection.schema.compatible else 'no'}")
    typer.echo(f"Journal mode: {inspection.journal_mode}")
    if inspection.schema.mismatches:
        typer.echo("Schema mismatches:")
        for mismatch in inspection.schema.mismatches:
            typer.echo(f"  - {mismatch}")

    typer.echo("Table counts:")
    for table_name, count in inspection.table_counts.items():
        typer.echo(f"  {table_name}: {count}")

    typer.echo(f"Foreign-key violations: {len(inspection.foreign_key_violations)}")
    for violation in inspection.foreign_key_violations:
        typer.echo(f"  - {violation}")

    typer.echo(f"Cross-owner contract links: {len(inspection.ownership_mismatches)}")
    for mismatch in inspection.ownership_mismatches:
        typer.echo(f"  - {mismatch}")

    typer.echo(f"Depots with mixed asset update dates: {len(inspection.mixed_depot_update_dates)}")
    for mismatch in inspection.mixed_depot_update_dates:
        typer.echo(f"  - {mismatch}")

    if inspection.aggregates:
        typer.echo("Financial aggregates:")
        for name, value in inspection.aggregates.items():
            typer.echo(f"  {name}: {value}")


@db_app.command("inspect")
def inspect_command() -> None:
    """Inspect the configured database without changing it."""
    try:
        inspection = inspect_database(_database_path())
    except (sqlite3.Error, OSError) as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(code=2) from None

    _print_inspection(inspection)
    if (
        not inspection.schema.compatible
        or inspection.foreign_key_violations
        or inspection.ownership_mismatches
    ):
        raise typer.Exit(code=1)


def _migration_error(exc: Exception) -> Never:
    typer.echo(str(exc), err=True)
    raise typer.Exit(code=1) from None


@contextmanager
def _management_session() -> Iterator[Session]:
    settings = load_settings()
    engine = create_database_engine(settings)
    try:
        session_factory = create_session_factory(engine)
        with session_scope(session_factory) as session:
            yield session
    finally:
        engine.dispose()


def _run_management_command[Result](operation: Callable[[Session], Result]) -> Result:
    try:
        with _management_session() as session:
            return operation(session)
    except (
        ConfigurationError,
        management.ManagementCommandError,
        SQLAlchemyError,
        sqlite3.Error,
        OSError,
    ) as exc:
        _migration_error(exc)
    raise AssertionError("management command error handler unexpectedly returned")


def _confirm_destructive_action(message: str, *, yes: bool) -> None:
    if yes:
        return
    if not typer.confirm(f"{message} Continue?"):
        raise typer.Abort()


def _print_summaries(summaries: tuple[object, ...]) -> None:
    for line in management.lines_for_summaries(summaries):
        typer.echo(line)


@db_app.command("bootstrap-existing")
def bootstrap_existing_command() -> None:
    """Verify and stamp an existing production database at the baseline."""
    try:
        settings = load_settings()
        bootstrap_existing_database(settings)
    except (
        ConfigurationError,
        DatabaseMigrationError,
        CommandError,
        SQLAlchemyError,
        sqlite3.Error,
        OSError,
    ) as exc:
        _migration_error(exc)
    typer.echo("Existing database stamped at revision 0001_legacy_baseline.")


@db_app.command("status")
def status_command() -> None:
    """Show the current and target Alembic revisions."""
    try:
        status = database_status(load_settings())
    except (
        ConfigurationError,
        DatabaseMigrationError,
        CommandError,
        SQLAlchemyError,
        sqlite3.Error,
        OSError,
    ) as exc:
        _migration_error(exc)
    typer.echo(f"Current revision: {status.current_revision or 'uninitialized'}")
    typer.echo(f"Head revision: {status.head_revision}")
    typer.echo(f"Pending upgrade: {'yes' if status.pending else 'no'}")


@db_app.command("upgrade")
def upgrade_command(revision: str = typer.Argument(default="head")) -> None:
    """Upgrade a fresh or adopted database to a revision."""
    try:
        upgrade_database(load_settings(), revision)
    except (
        ConfigurationError,
        DatabaseMigrationError,
        CommandError,
        SQLAlchemyError,
        sqlite3.Error,
        OSError,
    ) as exc:
        _migration_error(exc)
    typer.echo(f"Database upgraded to {revision}.")


def _password_option(password: str | None) -> str:
    if password is None:
        raise typer.BadParameter("A password is required")
    return password


@users_app.command("list")
def list_users_command() -> None:
    """List users without exposing password hashes or session data."""
    _print_summaries(_run_management_command(management.list_users))


@users_app.command("create")
def create_user_command(
    username: str = typer.Option(..., "--username", "-u", help="Unique username."),
    password: str | None = typer.Option(
        None,
        "--password",
        prompt=True,
        hide_input=True,
        confirmation_prompt=True,
        help="Password to store securely with Argon2id.",
    ),
    email: str = typer.Option("", "--email", help="Email address."),
    first_name: str = typer.Option("", "--first-name", help="First name."),
    last_name: str = typer.Option("", "--last-name", help="Last name."),
    superuser: bool = typer.Option(False, "--superuser", help="Create a superuser."),
) -> None:
    """Create an active user with an Argon2id password hash."""
    summary = _run_management_command(
        lambda session: management.create_user(
            session,
            username=username,
            password=_password_option(password),
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_superuser=superuser,
        )
    )
    typer.echo(f"Created user: {management.user_summary_line(summary)}")


@users_app.command("reset-password")
def reset_password_command(
    user_id: int | None = typer.Option(None, "--user-id", help="User ID."),
    username: str | None = typer.Option(None, "--username", help="Username."),
    password: str | None = typer.Option(
        None,
        "--password",
        prompt=True,
        hide_input=True,
        confirmation_prompt=True,
        help="Replacement password to store securely with Argon2id.",
    ),
    yes: bool = typer.Option(False, "--yes", help="Skip destructive-action confirmation."),
) -> None:
    """Reset one user's password after confirmation."""
    _confirm_destructive_action("Reset this user's password?", yes=yes)
    update = _run_management_command(
        lambda session: management.reset_user_password(
            session,
            user=management.resolve_user(session, user_id=user_id, username=username),
            password=_password_option(password),
        )
    )
    typer.echo(f"Password reset: {management.user_security_update_line(update)}")


@users_app.command("activate")
def activate_user_command(
    user_id: int | None = typer.Option(None, "--user-id", help="User ID."),
    username: str | None = typer.Option(None, "--username", help="Username."),
) -> None:
    """Activate a user account."""
    update = _run_management_command(
        lambda session: management.set_user_active(
            session,
            user=management.resolve_user(session, user_id=user_id, username=username),
            is_active=True,
        )
    )
    typer.echo(f"User activated: {management.user_security_update_line(update)}")


@users_app.command("deactivate")
def deactivate_user_command(
    user_id: int | None = typer.Option(None, "--user-id", help="User ID."),
    username: str | None = typer.Option(None, "--username", help="Username."),
    yes: bool = typer.Option(False, "--yes", help="Skip destructive-action confirmation."),
) -> None:
    """Deactivate a user account after confirmation."""
    _confirm_destructive_action("Deactivate this user?", yes=yes)
    update = _run_management_command(
        lambda session: management.set_user_active(
            session,
            user=management.resolve_user(session, user_id=user_id, username=username),
            is_active=False,
        )
    )
    typer.echo(f"User deactivated: {management.user_security_update_line(update)}")


@users_app.command("grant-superuser")
def grant_superuser_command(
    user_id: int | None = typer.Option(None, "--user-id", help="User ID."),
    username: str | None = typer.Option(None, "--username", help="Username."),
) -> None:
    """Grant superuser status to one user."""
    update = _run_management_command(
        lambda session: management.set_user_superuser(
            session,
            user=management.resolve_user(session, user_id=user_id, username=username),
            is_superuser=True,
        )
    )
    typer.echo(f"Superuser status granted: {management.user_security_update_line(update)}")


@users_app.command("revoke-superuser")
def revoke_superuser_command(
    user_id: int | None = typer.Option(None, "--user-id", help="User ID."),
    username: str | None = typer.Option(None, "--username", help="Username."),
    yes: bool = typer.Option(False, "--yes", help="Skip destructive-action confirmation."),
) -> None:
    """Revoke superuser status from one user after confirmation."""
    _confirm_destructive_action("Revoke superuser status from this user?", yes=yes)
    update = _run_management_command(
        lambda session: management.set_user_superuser(
            session,
            user=management.resolve_user(session, user_id=user_id, username=username),
            is_superuser=False,
        )
    )
    typer.echo(f"Superuser status revoked: {management.user_security_update_line(update)}")


@users_app.command("revoke-sessions")
def revoke_user_sessions_command(
    user_id: int | None = typer.Option(None, "--user-id", help="User ID."),
    username: str | None = typer.Option(None, "--username", help="Username."),
    yes: bool = typer.Option(False, "--yes", help="Skip destructive-action confirmation."),
) -> None:
    """Revoke every active session for one user."""
    _confirm_destructive_action("Revoke every active session for this user?", yes=yes)
    update = _run_management_command(
        lambda session: management.revoke_sessions_for_user(
            session,
            user=management.resolve_user(session, user_id=user_id, username=username),
        )
    )
    typer.echo(f"Sessions revoked: {management.user_security_update_line(update)}")


@sessions_app.command("revoke-all")
def revoke_all_sessions_command(
    yes: bool = typer.Option(False, "--yes", help="Skip destructive-action confirmation."),
) -> None:
    """Revoke every active application session."""
    _confirm_destructive_action("Revoke every active application session?", yes=yes)
    count = _run_management_command(management.revoke_every_session)
    typer.echo(f"Revoked sessions: {count}")


@sessions_app.command("cleanup-expired")
def cleanup_expired_sessions_command() -> None:
    """Delete sessions whose expiry time has passed."""
    count = _run_management_command(management.cleanup_sessions)
    typer.echo(f"Deleted expired sessions: {count}")


@contract_files_app.command("reconcile")
def reconcile_contract_files_command(
    delete_orphans: bool = typer.Option(
        False,
        "--delete-orphans",
        help="Delete files that are not referenced by a database row.",
    ),
    yes: bool = typer.Option(False, "--yes", help="Skip destructive-action confirmation."),
) -> None:
    """Report missing, invalid, and orphaned contract files."""
    try:
        settings = load_settings()
    except ConfigurationError as exc:
        _migration_error(exc)
    report = _run_management_command(
        lambda session: reconcile_contract_files(session, settings.media_root)
    )
    typer.echo(f"Missing referenced files: {len(report.missing)}")
    for item in report.missing:
        typer.echo(f"  - {item}")
    typer.echo(f"Invalid stored paths: {len(report.invalid)}")
    for item in report.invalid:
        typer.echo(f"  - {item}")
    typer.echo(f"Orphaned files: {len(report.orphaned)}")
    for path in report.orphaned:
        typer.echo(f"  - {path.relative_to(settings.media_root)}")

    if delete_orphans and report.orphaned:
        _confirm_destructive_action("Delete every reported orphaned file?", yes=yes)
        deleted = delete_orphaned_contract_files(report)
        typer.echo(f"Deleted orphaned files: {deleted}")
    elif report.missing or report.invalid or report.orphaned:
        raise typer.Exit(code=1)


@accounts_app.command("list")
def list_accounts_command(
    owner_id: int | None = typer.Option(None, "--owner-id", help="Filter by owner ID."),
    owner_username: str | None = typer.Option(
        None, "--owner-username", help="Filter by owner username."
    ),
) -> None:
    """List bank accounts, optionally for one explicitly selected owner."""
    summaries = _run_management_command(
        lambda session: management.list_accounts(
            session,
            owner=management.resolve_optional_owner(
                session,
                owner_id=owner_id,
                owner_username=owner_username,
            ),
        )
    )
    _print_summaries(summaries)


@accounts_app.command("create")
def create_account_command(
    name: str = typer.Option(..., "--name", help="Account name."),
    bank: str = typer.Option(..., "--bank", help="Bank name."),
    current_amount: str = typer.Option(..., "--current-amount", help="Starting balance."),
    owner_id: int | None = typer.Option(None, "--owner-id", help="Owner user ID."),
    owner_username: str | None = typer.Option(None, "--owner-username", help="Owner username."),
) -> None:
    """Create a bank account for exactly one explicitly selected owner."""
    summary = _run_management_command(
        lambda session: management.create_account(
            session,
            name=name,
            bank=bank,
            current_amount=current_amount,
            owner=management.resolve_owner(
                session,
                owner_id=owner_id,
                owner_username=owner_username,
            ),
        )
    )
    typer.echo(f"Created account: {management.account_summary_line(summary)}")


@accounts_app.command("update")
def update_account_command(
    account_id: int = typer.Option(..., "--account-id", help="Account ID."),
    name: str | None = typer.Option(None, "--name", help="New account name."),
    bank: str | None = typer.Option(None, "--bank", help="New bank name."),
    current_amount: str | None = typer.Option(
        None, "--current-amount", help="New starting balance."
    ),
    owner_id: int | None = typer.Option(None, "--owner-id", help="New owner user ID."),
    owner_username: str | None = typer.Option(None, "--owner-username", help="New owner username."),
) -> None:
    """Update account fields and optionally move it to an explicit owner."""
    summary = _run_management_command(
        lambda session: management.update_account(
            session,
            account_id=account_id,
            name=name,
            bank=bank,
            current_amount=current_amount,
            owner=management.resolve_optional_owner(
                session,
                owner_id=owner_id,
                owner_username=owner_username,
            ),
        )
    )
    typer.echo(f"Updated account: {management.account_summary_line(summary)}")


@depots_app.command("list")
def list_depots_command(
    owner_id: int | None = typer.Option(None, "--owner-id", help="Filter by owner ID."),
    owner_username: str | None = typer.Option(
        None, "--owner-username", help="Filter by owner username."
    ),
) -> None:
    """List bank depots, optionally for one explicitly selected owner."""
    summaries = _run_management_command(
        lambda session: management.list_depots(
            session,
            owner=management.resolve_optional_owner(
                session,
                owner_id=owner_id,
                owner_username=owner_username,
            ),
        )
    )
    _print_summaries(summaries)


@depots_app.command("create")
def create_depot_command(
    name: str = typer.Option(..., "--name", help="Depot name."),
    owner_id: int | None = typer.Option(None, "--owner-id", help="Owner user ID."),
    owner_username: str | None = typer.Option(None, "--owner-username", help="Owner username."),
) -> None:
    """Create a depot for exactly one explicitly selected owner."""
    summary = _run_management_command(
        lambda session: management.create_depot(
            session,
            name=name,
            owner=management.resolve_owner(
                session,
                owner_id=owner_id,
                owner_username=owner_username,
            ),
        )
    )
    typer.echo(f"Created depot: {management.depot_summary_line(summary)}")


@depots_app.command("update")
def update_depot_command(
    depot_id: int = typer.Option(..., "--depot-id", help="Depot ID."),
    name: str | None = typer.Option(None, "--name", help="New depot name."),
    owner_id: int | None = typer.Option(None, "--owner-id", help="New owner user ID."),
    owner_username: str | None = typer.Option(None, "--owner-username", help="New owner username."),
) -> None:
    """Update depot fields and optionally move it to an explicit owner."""
    summary = _run_management_command(
        lambda session: management.update_depot(
            session,
            depot_id=depot_id,
            name=name,
            owner=management.resolve_optional_owner(
                session,
                owner_id=owner_id,
                owner_username=owner_username,
            ),
        )
    )
    typer.echo(f"Updated depot: {management.depot_summary_line(summary)}")


@assets_app.command("create")
def create_asset_command(
    name: str = typer.Option(..., "--name", help="Asset name."),
    current_balance: str = typer.Option(..., "--current-balance", help="Current value."),
    last_update: str = typer.Option(..., "--last-update", help="ISO-8601 update date."),
    depot_id: int = typer.Option(..., "--depot-id", help="Containing depot ID."),
) -> None:
    """Create an asset in one explicitly selected depot."""
    summary = _run_management_command(
        lambda session: management.create_asset(
            session,
            name=name,
            current_balance=current_balance,
            last_update=last_update,
            depot_id=depot_id,
        )
    )
    typer.echo(f"Created asset: {management.asset_summary_line(summary)}")


@assets_app.command("update")
def update_asset_command(
    asset_id: int = typer.Option(..., "--asset-id", help="Asset ID."),
    name: str | None = typer.Option(None, "--name", help="New asset name."),
    current_balance: str | None = typer.Option(
        None, "--current-balance", help="New current value."
    ),
    last_update: str | None = typer.Option(None, "--last-update", help="New ISO-8601 update date."),
    depot_id: int | None = typer.Option(None, "--depot-id", help="New containing depot ID."),
) -> None:
    """Update an asset and optionally move it to another depot."""
    summary = _run_management_command(
        lambda session: management.update_asset(
            session,
            asset_id=asset_id,
            name=name,
            current_balance=current_balance,
            last_update=last_update,
            depot_id=depot_id,
        )
    )
    typer.echo(f"Updated asset: {management.asset_summary_line(summary)}")


@asset_transactions_app.command("create")
def create_asset_transaction_command(
    asset_id: int = typer.Option(..., "--asset-id", help="Asset ID."),
    amount: str = typer.Option(..., "--amount", help="Transaction amount."),
    date_issue: str = typer.Option(..., "--date-issue", help="ISO-8601 booking date."),
) -> None:
    """Create an asset transaction for one explicitly selected asset."""
    summary = _run_management_command(
        lambda session: management.create_asset_transaction(
            session,
            asset_id=asset_id,
            amount=amount,
            date_issue=date_issue,
        )
    )
    typer.echo(f"Created asset transaction: {management.asset_transaction_summary_line(summary)}")


@asset_transactions_app.command("delete")
def delete_asset_transaction_command(
    transaction_id: int = typer.Option(..., "--transaction-id", help="Asset transaction ID."),
    yes: bool = typer.Option(False, "--yes", help="Skip destructive-action confirmation."),
) -> None:
    """Delete an asset transaction after confirmation."""
    _confirm_destructive_action("Delete this asset transaction?", yes=yes)
    summary = _run_management_command(
        lambda session: management.delete_asset_transaction(
            session,
            transaction_id=transaction_id,
        )
    )
    typer.echo(f"Deleted asset transaction: {management.asset_transaction_summary_line(summary)}")
