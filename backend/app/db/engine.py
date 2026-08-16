from collections.abc import Generator, Iterator
from contextlib import contextmanager
from sqlite3 import Connection

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.db.transaction_hooks import (
    run_after_commit_callbacks,
    run_after_rollback_callbacks,
    run_before_commit_callbacks,
)
from app.patterns import matches_pattern_text

SQLITE_BUSY_TIMEOUT_MS = 5_000

SessionFactory = sessionmaker[Session]


def _sqlite_patterns_match(recipient: object, subject: object, patterns: object) -> int:
    return int(
        matches_pattern_text(
            recipient if isinstance(recipient, str) else None,
            subject if isinstance(subject, str) else None,
            patterns if isinstance(patterns, str) else "",
        )
    )


def _configure_sqlite_connection(dbapi_connection: Connection, _connection_record: object) -> None:
    dbapi_connection.create_function(
        "finances_patterns_match",
        3,
        _sqlite_patterns_match,
        deterministic=True,
    )
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}")
    finally:
        cursor.close()


def create_database_engine(settings: Settings) -> Engine:
    url = URL.create(drivername="sqlite+pysqlite", database=str(settings.database_path))
    engine = create_engine(
        url,
        connect_args={
            "check_same_thread": False,
            "timeout": SQLITE_BUSY_TIMEOUT_MS / 1_000,
        },
    )
    event.listen(engine, "connect", _configure_sqlite_connection)
    return engine


def create_session_factory(engine: Engine) -> SessionFactory:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@contextmanager
def session_scope(session_factory: SessionFactory) -> Iterator[Session]:
    session = session_factory()
    try:
        try:
            yield session
            run_before_commit_callbacks(session)
            session.commit()
        except BaseException:
            session.rollback()
            run_after_rollback_callbacks(session)
            raise
        else:
            run_after_commit_callbacks(session)
    finally:
        session.close()


def request_session(request: Request) -> Generator[Session]:
    session_factory: SessionFactory = request.app.state.session_factory
    with session_scope(session_factory) as session:
        yield session
