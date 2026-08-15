from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy.engine import URL

from alembic import command
from app.config import Settings
from app.db.engine import create_database_engine
from app.db.schema import inspect_database, open_read_only_database

BASELINE_REVISION = "0001_legacy_baseline"


class DatabaseMigrationError(RuntimeError):
    """Raised when a database cannot be safely adopted or migrated."""


@dataclass(frozen=True)
class DatabaseStatus:
    current_revision: str | None
    head_revision: str

    @property
    def pending(self) -> bool:
        return self.current_revision != self.head_revision


def alembic_config(settings: Settings) -> Config:
    config_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    config = Config(str(config_path))
    url = URL.create(drivername="sqlite+pysqlite", database=str(settings.database_path))
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False))
    config.attributes["settings"] = settings
    return config


def _table_names(database_path: Path) -> set[str]:
    with open_read_only_database(database_path) as connection:
        return {
            str(row[0])
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }


def bootstrap_existing_database(settings: Settings) -> None:
    inspection = inspect_database(settings.database_path)
    if not inspection.schema.compatible:
        details = "; ".join(inspection.schema.mismatches)
        raise DatabaseMigrationError(f"Database schema is incompatible: {details}")
    if inspection.foreign_key_violations:
        raise DatabaseMigrationError("Database has foreign-key violations and cannot be adopted")
    if "alembic_version" in inspection.table_counts:
        raise DatabaseMigrationError(
            "Database already contains alembic_version; refusing unexpected adoption state"
        )
    if "finances_session" in inspection.table_counts:
        raise DatabaseMigrationError(
            "Database already contains finances_session without Alembic state"
        )

    command.stamp(alembic_config(settings), BASELINE_REVISION)


def database_status(settings: Settings) -> DatabaseStatus:
    if not settings.database_path.is_file():
        raise DatabaseMigrationError(f"Database file is unavailable: {settings.database_path}")

    config = alembic_config(settings)
    head_revision = ScriptDirectory.from_config(config).get_current_head()
    if head_revision is None:
        raise DatabaseMigrationError("Alembic has no head revision")

    current_revision: str | None = None
    if "alembic_version" in _table_names(settings.database_path):
        engine = create_database_engine(settings)
        try:
            with engine.connect() as connection:
                current_revision = MigrationContext.configure(connection).get_current_revision()
        finally:
            engine.dispose()

    return DatabaseStatus(
        current_revision=current_revision,
        head_revision=head_revision,
    )


def upgrade_database(settings: Settings, revision: str = "head") -> None:
    database_path = settings.database_path
    if database_path.exists() and not database_path.is_file():
        raise DatabaseMigrationError(f"Database path is not a file: {database_path}")
    if not database_path.parent.is_dir():
        raise DatabaseMigrationError(f"Database directory is unavailable: {database_path.parent}")

    if database_path.is_file():
        tables = _table_names(database_path)
        application_tables = tables - {"sqlite_sequence"}
        if application_tables and "alembic_version" not in tables:
            raise DatabaseMigrationError(
                "Existing database is not initialized with Alembic; run "
                "'finances db bootstrap-existing' first"
            )

    try:
        command.upgrade(alembic_config(settings), revision)
    except (sqlite3.Error, OSError) as exc:
        raise DatabaseMigrationError(f"Database upgrade failed: {exc}") from exc
