from __future__ import annotations

from logging.config import fileConfig
from typing import Any, cast

from alembic import context
from app.config import Settings, load_settings
from app.db.base import Base
from app.db.engine import create_database_engine
from app.db.models import LEGACY_MANAGED_TABLE_NAMES, MANAGED_TABLE_NAMES

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

configured_settings = config.attributes.get("settings")
settings = cast(Settings, configured_settings) if configured_settings else load_settings()
target_metadata = Base.metadata


def include_object(
    object_: Any,
    name: str | None,
    type_: str,
    _reflected: bool,
    _compare_to: Any,
) -> bool:
    if type_ == "table":
        return name in MANAGED_TABLE_NAMES
    if type_ in {"foreign_key_constraint", "unique_constraint"}:
        table = getattr(object_, "table", None)
        if table is not None and table.name in LEGACY_MANAGED_TABLE_NAMES:
            # SQLite reflection loses Django's deferred-FK options and unnamed
            # unique constraints. The adoption validator checks their semantics.
            return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True,
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_database_engine(settings)
    try:
        with engine.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                include_object=include_object,
                compare_type=True,
                render_as_batch=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
