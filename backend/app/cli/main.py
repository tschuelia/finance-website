import sqlite3
from pathlib import Path
from typing import Never

import typer
from alembic.util import CommandError
from sqlalchemy.exc import SQLAlchemyError

from app.config import ConfigurationError, load_settings
from app.db.migrations import (
    DatabaseMigrationError,
    bootstrap_existing_database,
    database_status,
    upgrade_database,
)
from app.db.schema import DatabaseInspection, inspect_database

app = typer.Typer(help="Finances management commands.", no_args_is_help=True)
db_app = typer.Typer(help="Inspect and migrate the finances database.", no_args_is_help=True)
app.add_typer(db_app, name="db")


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
    if not inspection.schema.compatible or inspection.foreign_key_violations:
        raise typer.Exit(code=1)


def _migration_error(exc: Exception) -> Never:
    typer.echo(str(exc), err=True)
    raise typer.Exit(code=1) from None


@db_app.command("bootstrap-existing")
def bootstrap_existing_command() -> None:
    """Verify and stamp an existing Django database at the baseline."""
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
