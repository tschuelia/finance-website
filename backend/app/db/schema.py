from __future__ import annotations

import re
import sqlite3
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from pathlib import Path

from app.db.engine import SQLITE_BUSY_TIMEOUT_MS


class ColumnKind(Enum):
    INTEGER = "integer"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    STRING = "string"
    TEXT = "text"
    DATE = "date"
    DATETIME = "datetime"


@dataclass(frozen=True)
class ColumnSpec:
    kind: ColumnKind
    nullable: bool = False
    primary_key: bool = False
    length: int | None = None


@dataclass(frozen=True)
class ForeignKeySpec:
    column: str
    target_table: str
    target_column: str = "id"


@dataclass(frozen=True)
class TableSpec:
    columns: Mapping[str, ColumnSpec]
    foreign_keys: frozenset[ForeignKeySpec] = frozenset()
    indexed_columns: frozenset[tuple[str, ...]] = frozenset()
    unique_columns: frozenset[tuple[str, ...]] = frozenset()


@dataclass(frozen=True)
class SchemaReport:
    mismatches: tuple[str, ...]

    @property
    def compatible(self) -> bool:
        return not self.mismatches


@dataclass(frozen=True)
class DatabaseInspection:
    schema: SchemaReport
    journal_mode: str
    table_counts: Mapping[str, int]
    foreign_key_violations: tuple[str, ...]
    ownership_mismatches: tuple[str, ...]
    mixed_depot_update_dates: tuple[str, ...]
    aggregates: Mapping[str, Decimal]


def _column(
    kind: ColumnKind,
    *,
    nullable: bool = False,
    primary_key: bool = False,
    length: int | None = None,
) -> ColumnSpec:
    return ColumnSpec(kind, nullable=nullable, primary_key=primary_key, length=length)


ID_COLUMN = _column(ColumnKind.INTEGER, primary_key=True)

PRODUCTION_DATABASE_SCHEMA: dict[str, TableSpec] = {
    "auth_user": TableSpec(
        columns={
            "id": ID_COLUMN,
            "password": _column(ColumnKind.STRING, length=128),
            "last_login": _column(ColumnKind.DATETIME, nullable=True),
            "is_superuser": _column(ColumnKind.BOOLEAN),
            "username": _column(ColumnKind.STRING, length=150),
            "last_name": _column(ColumnKind.STRING, length=150),
            "email": _column(ColumnKind.STRING, length=254),
            "is_staff": _column(ColumnKind.BOOLEAN),
            "is_active": _column(ColumnKind.BOOLEAN),
            "date_joined": _column(ColumnKind.DATETIME),
            "first_name": _column(ColumnKind.STRING, length=150),
        },
        unique_columns=frozenset({("username",)}),
    ),
    "accounting_bankaccount": TableSpec(
        columns={
            "id": ID_COLUMN,
            "name": _column(ColumnKind.STRING, length=255),
            "bank": _column(ColumnKind.STRING, length=255),
            "current_amount": _column(ColumnKind.DECIMAL),
            "owner_id": _column(ColumnKind.INTEGER),
        },
        foreign_keys=frozenset({ForeignKeySpec("owner_id", "auth_user")}),
        indexed_columns=frozenset({("owner_id",)}),
    ),
    "accounting_bankdepot": TableSpec(
        columns={
            "id": ID_COLUMN,
            "name": _column(ColumnKind.STRING, length=255),
            "owner_id": _column(ColumnKind.INTEGER),
        },
        foreign_keys=frozenset({ForeignKeySpec("owner_id", "auth_user")}),
        indexed_columns=frozenset({("owner_id",)}),
    ),
    "accounting_depotasset": TableSpec(
        columns={
            "id": ID_COLUMN,
            "name": _column(ColumnKind.STRING, length=255),
            "current_balance": _column(ColumnKind.DECIMAL),
            "bank_depot_id": _column(ColumnKind.INTEGER, nullable=True),
            "last_update": _column(ColumnKind.DATE),
        },
        foreign_keys=frozenset({ForeignKeySpec("bank_depot_id", "accounting_bankdepot")}),
        indexed_columns=frozenset({("bank_depot_id",)}),
    ),
    "accounting_depotassettransaction": TableSpec(
        columns={
            "id": ID_COLUMN,
            "amount": _column(ColumnKind.DECIMAL),
            "date_issue": _column(ColumnKind.DATE),
            "asset_id": _column(ColumnKind.INTEGER, nullable=True),
        },
        foreign_keys=frozenset({ForeignKeySpec("asset_id", "accounting_depotasset")}),
        indexed_columns=frozenset({("asset_id",)}),
    ),
    "accounting_category": TableSpec(
        columns={
            "id": ID_COLUMN,
            "name": _column(ColumnKind.STRING, length=255),
            "patterns": _column(ColumnKind.TEXT),
        },
        unique_columns=frozenset({("name",)}),
    ),
    "accounting_contract": TableSpec(
        columns={
            "id": ID_COLUMN,
            "name": _column(ColumnKind.STRING, length=255),
            "description": _column(ColumnKind.TEXT, nullable=True),
            "owner_id": _column(ColumnKind.INTEGER),
            "is_active": _column(ColumnKind.BOOLEAN),
            "end_date": _column(ColumnKind.DATE, nullable=True),
            "start_date": _column(ColumnKind.DATE, nullable=True),
        },
        foreign_keys=frozenset({ForeignKeySpec("owner_id", "auth_user")}),
        indexed_columns=frozenset({("owner_id",)}),
    ),
    "accounting_contractfile": TableSpec(
        columns={
            "id": ID_COLUMN,
            "file": _column(ColumnKind.STRING, length=100),
            "filename": _column(ColumnKind.STRING, length=255),
            "contract_id": _column(ColumnKind.INTEGER),
        },
        foreign_keys=frozenset({ForeignKeySpec("contract_id", "accounting_contract")}),
        indexed_columns=frozenset({("contract_id",)}),
    ),
    "accounting_transaction": TableSpec(
        columns={
            "id": ID_COLUMN,
            "recipient": _column(ColumnKind.STRING, length=255),
            "amount": _column(ColumnKind.DECIMAL),
            "subject": _column(ColumnKind.STRING, length=1024),
            "date_issue": _column(ColumnKind.DATE),
            "date_booking": _column(ColumnKind.DATE, nullable=True),
            "full_subject_string": _column(ColumnKind.TEXT),
            "bank_account_id": _column(ColumnKind.INTEGER, nullable=True),
            "category_id": _column(ColumnKind.INTEGER, nullable=True),
            "contract_id": _column(ColumnKind.INTEGER, nullable=True),
        },
        foreign_keys=frozenset(
            {
                ForeignKeySpec("bank_account_id", "accounting_bankaccount"),
                ForeignKeySpec("category_id", "accounting_category"),
                ForeignKeySpec("contract_id", "accounting_contract"),
            }
        ),
        indexed_columns=frozenset({("bank_account_id",), ("category_id",), ("contract_id",)}),
    ),
}


@contextmanager
def open_read_only_database(database_path: Path) -> Iterator[sqlite3.Connection]:
    if not database_path.is_file():
        raise FileNotFoundError(f"Database file is unavailable: {database_path}")

    connection = sqlite3.connect(
        f"{database_path.as_uri()}?mode=ro",
        uri=True,
        timeout=SQLITE_BUSY_TIMEOUT_MS / 1_000,
    )
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA query_only=ON")
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}")
        yield connection
    finally:
        connection.close()


def _declared_type_matches(declared_type: str, spec: ColumnSpec) -> bool:
    normalized = declared_type.strip().upper()
    base_type = normalized.partition("(")[0].strip()

    if spec.kind is ColumnKind.INTEGER:
        return "INT" in base_type
    if spec.kind is ColumnKind.DECIMAL:
        return base_type in {"DECIMAL", "NUMERIC"}
    if spec.kind is ColumnKind.BOOLEAN:
        return base_type in {"BOOL", "BOOLEAN"}
    if spec.kind is ColumnKind.TEXT:
        return base_type == "TEXT"
    if spec.kind is ColumnKind.DATE:
        return base_type == "DATE"
    if spec.kind is ColumnKind.DATETIME:
        return base_type in {"DATETIME", "TIMESTAMP"}
    if spec.kind is ColumnKind.STRING:
        match = re.fullmatch(r"(?:VAR)?CHAR\((\d+)\)", normalized)
        return match is not None and int(match.group(1)) == spec.length
    return False


def _index_columns(
    connection: sqlite3.Connection, table_name: str
) -> tuple[set[tuple[str, ...]], set[tuple[str, ...]]]:
    indexed: set[tuple[str, ...]] = set()
    unique: set[tuple[str, ...]] = set()
    for index in connection.execute(f'PRAGMA index_list("{table_name}")'):
        index_name = str(index[1]).replace('"', '""')
        columns = tuple(
            str(row[2]) for row in connection.execute(f'PRAGMA index_info("{index_name}")')
        )
        if not columns:
            continue
        indexed.add(columns)
        if bool(index[2]):
            unique.add(columns)
    return indexed, unique


def _validate_columns(
    connection: sqlite3.Connection,
    table_name: str,
    table_spec: TableSpec,
) -> list[str]:
    mismatches: list[str] = []
    actual_columns = {
        str(row[1]): row for row in connection.execute(f'PRAGMA table_info("{table_name}")')
    }
    expected_names = set(table_spec.columns)
    actual_names = set(actual_columns)
    mismatches.extend(
        f"{table_name}: missing column {column_name}"
        for column_name in sorted(expected_names - actual_names)
    )
    mismatches.extend(
        f"{table_name}: unexpected column {column_name}"
        for column_name in sorted(actual_names - expected_names)
    )
    for column_name in sorted(expected_names & actual_names):
        expected = table_spec.columns[column_name]
        actual = actual_columns[column_name]
        declared_type = str(actual[2])
        if not _declared_type_matches(declared_type, expected):
            mismatches.append(
                f"{table_name}.{column_name}: incompatible type {declared_type or '<empty>'}"
            )
        actual_primary_key = bool(actual[5])
        if actual_primary_key != expected.primary_key:
            mismatches.append(f"{table_name}.{column_name}: primary-key status differs")
        actual_nullable = not bool(actual[3]) and not actual_primary_key
        if actual_nullable != expected.nullable:
            mismatches.append(f"{table_name}.{column_name}: nullability differs")
    return mismatches


def _validate_foreign_keys(
    connection: sqlite3.Connection,
    table_name: str,
    table_spec: TableSpec,
) -> list[str]:
    actual = frozenset(
        ForeignKeySpec(column=str(row[3]), target_table=str(row[2]), target_column=str(row[4]))
        for row in connection.execute(f'PRAGMA foreign_key_list("{table_name}")')
    )
    return [] if actual == table_spec.foreign_keys else [f"{table_name}: foreign keys differ"]


def _validate_indexes(
    connection: sqlite3.Connection,
    table_name: str,
    table_spec: TableSpec,
) -> list[str]:
    indexed_columns, unique_columns = _index_columns(connection, table_name)
    return [
        *(
            f"{table_name}: missing index on ({', '.join(columns)})"
            for columns in sorted(table_spec.indexed_columns - indexed_columns)
        ),
        *(
            f"{table_name}: missing unique constraint on ({', '.join(columns)})"
            for columns in sorted(table_spec.unique_columns - unique_columns)
        ),
    ]


def validate_production_schema(connection: sqlite3.Connection) -> SchemaReport:
    existing_tables = {
        str(row[0])
        for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    }
    mismatches: list[str] = []
    for table_name, table_spec in PRODUCTION_DATABASE_SCHEMA.items():
        if table_name not in existing_tables:
            mismatches.append(f"missing table: {table_name}")
            continue
        mismatches.extend(_validate_columns(connection, table_name, table_spec))
        mismatches.extend(_validate_foreign_keys(connection, table_name, table_spec))
        mismatches.extend(_validate_indexes(connection, table_name, table_spec))
    return SchemaReport(mismatches=tuple(mismatches))


def _quote_identifier(identifier: str) -> str:
    return f'"{identifier.replace(chr(34), chr(34) * 2)}"'


def _decimal_total(connection: sqlite3.Connection, query: str) -> Decimal:
    return sum(
        (Decimal(str(row[0])) for row in connection.execute(query)),
        Decimal("0"),
    )


def _table_counts(connection: sqlite3.Connection) -> dict[str, int]:
    table_names = [
        str(row[0])
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        )
    ]
    return {
        table_name: int(
            connection.execute(f"SELECT COUNT(*) FROM {_quote_identifier(table_name)}").fetchone()[
                0
            ]
        )
        for table_name in table_names
    }


def _foreign_key_violations(connection: sqlite3.Connection) -> tuple[str, ...]:
    return tuple(
        f"{row[0]} row {row[1]} references {row[2]} (foreign key {row[3]})"
        for row in connection.execute("PRAGMA foreign_key_check")
    )


def _ownership_mismatches(connection: sqlite3.Connection) -> tuple[str, ...]:
    return tuple(
        (
            f"transaction {row[0]} links account owner {row[1]} "
            f"to contract {row[2]} owned by {row[3]}"
        )
        for row in connection.execute(
            """
            SELECT transaction_row.id,
                   account.owner_id,
                   contract.id,
                   contract.owner_id
            FROM accounting_transaction AS transaction_row
            JOIN accounting_bankaccount AS account
              ON account.id = transaction_row.bank_account_id
            JOIN accounting_contract AS contract
              ON contract.id = transaction_row.contract_id
            WHERE account.owner_id != contract.owner_id
            ORDER BY transaction_row.id
            """
        )
    )


def _mixed_depot_update_dates(connection: sqlite3.Connection) -> tuple[str, ...]:
    return tuple(
        f"depot {row[0]} combines {row[1]} distinct asset update dates"
        for row in connection.execute(
            """
            SELECT bank_depot_id, COUNT(DISTINCT last_update)
            FROM accounting_depotasset
            WHERE bank_depot_id IS NOT NULL
            GROUP BY bank_depot_id
            HAVING COUNT(DISTINCT last_update) > 1
            ORDER BY bank_depot_id
            """
        )
    )


def _aggregates(connection: sqlite3.Connection) -> dict[str, Decimal]:
    account_starting = _decimal_total(
        connection, "SELECT current_amount FROM accounting_bankaccount"
    )
    transaction_net = _decimal_total(connection, "SELECT amount FROM accounting_transaction")
    account_balances = account_starting + transaction_net
    depot_balances = _decimal_total(connection, "SELECT current_balance FROM accounting_depotasset")
    return {
        "account starting balances": account_starting,
        "transaction net": transaction_net,
        "calculated account balances": account_balances,
        "depot current balances": depot_balances,
        "account plus depot balance": account_balances + depot_balances,
        "depot-asset transaction net": _decimal_total(
            connection, "SELECT amount FROM accounting_depotassettransaction"
        ),
        "contract-linked transaction net": _decimal_total(
            connection,
            "SELECT amount FROM accounting_transaction WHERE contract_id IS NOT NULL",
        ),
    }


def inspect_database(database_path: Path) -> DatabaseInspection:
    with open_read_only_database(database_path) as connection:
        journal_mode = str(connection.execute("PRAGMA journal_mode").fetchone()[0])
        schema = validate_production_schema(connection)
        counts = _table_counts(connection)
        violations = _foreign_key_violations(connection)
        ownership_mismatches = _ownership_mismatches(connection) if schema.compatible else ()
        mixed_depot_update_dates = (
            _mixed_depot_update_dates(connection) if schema.compatible else ()
        )
        aggregates = _aggregates(connection) if schema.compatible else {}
    return DatabaseInspection(
        schema=schema,
        journal_mode=journal_mode,
        table_counts=counts,
        foreign_key_violations=violations,
        ownership_mismatches=ownership_mismatches,
        mixed_depot_update_dates=mixed_depot_update_dates,
        aggregates=aggregates,
    )
