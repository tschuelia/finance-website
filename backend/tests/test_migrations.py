import sqlite3
from pathlib import Path

from app.config import Settings
from app.db.migrations import database_status, upgrade_database
from app.db.schema import inspect_database


def _settings_for_database(settings: Settings, database_path: Path) -> Settings:
    return settings.model_copy(update={"database_path": database_path.resolve()})


def test_fresh_database_upgrades_to_head(settings: Settings, tmp_path: Path) -> None:
    migration_settings = _settings_for_database(settings, tmp_path / "fresh.sqlite3")
    upgrade_database(migration_settings)

    status = database_status(migration_settings)
    inspection = inspect_database(migration_settings.database_path)
    assert status.current_revision == "0006_assignment_review"
    assert status.current_revision == status.head_revision
    assert inspection.schema.compatible
    assert inspection.foreign_key_violations == ()


def test_upgrade_labels_mixed_date_depot_snapshot_as_estimated(
    settings: Settings,
    tmp_path: Path,
) -> None:
    migration_settings = _settings_for_database(settings, tmp_path / "upgrade.sqlite3")
    upgrade_database(migration_settings, "0002_server_sessions")
    with sqlite3.connect(migration_settings.database_path) as connection:
        connection.execute(
            """
            INSERT INTO auth_user (
                id, password, last_login, is_superuser, username, last_name,
                email, is_staff, is_active, date_joined, first_name
            ) VALUES (1, 'hash', NULL, 0, 'alice', '', '', 0, 1, '2026-01-01', '')
            """
        )
        connection.execute(
            "INSERT INTO accounting_bankdepot (id, name, owner_id) VALUES (1, 'Depot', 1)"
        )
        connection.executemany(
            """
            INSERT INTO accounting_depotasset (
                id, name, current_balance, bank_depot_id, last_update
            ) VALUES (?, ?, ?, 1, ?)
            """,
            (
                (1, "Früher", "10.00", "2026-01-01"),
                (2, "Später", "20.00", "2026-02-01"),
            ),
        )

    upgrade_database(migration_settings)
    with sqlite3.connect(migration_settings.database_path) as connection:
        snapshot = connection.execute(
            """
            SELECT date, balance, is_estimated
            FROM finances_depot_balance_snapshot
            WHERE bank_depot_id = 1
            """
        ).fetchone()
    assert snapshot == ("2026-02-01", 30, 1)


def test_schema_validator_reports_incompatible_production_shape(
    settings: Settings,
    tmp_path: Path,
) -> None:
    migration_settings = _settings_for_database(settings, tmp_path / "incompatible.sqlite3")
    upgrade_database(migration_settings)
    with sqlite3.connect(migration_settings.database_path) as connection:
        connection.execute("ALTER TABLE auth_user RENAME COLUMN email TO unexpected_email")

    inspection = inspect_database(migration_settings.database_path)
    assert not inspection.schema.compatible
    assert "auth_user: missing column email" in inspection.schema.mismatches
    assert "auth_user: unexpected column unexpected_email" in inspection.schema.mismatches
