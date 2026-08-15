import os
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.auth.passwords import hash_password
from app.config import Settings
from app.db import Base, create_database_engine, create_session_factory
from app.db.models import BankAccount, Contract, User

os.environ.setdefault(
    "FINANCES_SESSION_SECRET",
    "test-module-session-secret-that-is-at-least-32-bytes",
)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    media_root = tmp_path / "media"
    media_root.mkdir()
    return Settings(
        session_secret="test-session-secret-that-is-at-least-32-bytes",
        database_path=tmp_path / "test.sqlite3",
        media_root=media_root,
        allowed_hosts=["testserver"],
        development_logging=False,
        csv_upload_max_bytes=64,
        contract_upload_max_bytes=64,
    )


@pytest.fixture
def engine(settings: Settings) -> Iterator[Engine]:
    database_engine = create_database_engine(settings)
    Base.metadata.create_all(database_engine)
    try:
        yield database_engine
    finally:
        database_engine.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return create_session_factory(engine)


@pytest.fixture
def session(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    database_session = session_factory()
    try:
        yield database_session
        database_session.rollback()
    finally:
        database_session.close()


@pytest.fixture
def app_client(settings: Settings, engine: Engine) -> Iterator[TestClient]:
    from app.auth.throttle import login_throttle
    from app.main import create_app

    login_throttle.clear()
    with TestClient(create_app(settings)) as client:
        yield client
    login_throttle.clear()


def add_user(
    session: Session,
    username: str,
    *,
    password: str = "test-password",
    is_superuser: bool = False,
) -> User:
    user = User(
        username=username,
        password=hash_password(password),
        email="",
        first_name="",
        last_name="",
        is_active=True,
        is_staff=is_superuser,
        is_superuser=is_superuser,
        last_login=None,
        date_joined=datetime.now(UTC).replace(tzinfo=None),
    )
    session.add(user)
    session.flush()
    return user


def add_account(session: Session, owner: User, *, name: str = "Girokonto") -> BankAccount:
    account = BankAccount(
        name=name,
        bank="n26",
        current_amount="0.00",
        owner_id=owner.id,
    )
    session.add(account)
    session.flush()
    return account


def add_contract(session: Session, owner: User, *, name: str = "Vertrag") -> Contract:
    contract = Contract(
        name=name,
        description=None,
        patterns="",
        owner_id=owner.id,
        is_active=True,
        start_date=None,
        end_date=None,
    )
    session.add(contract)
    session.flush()
    return contract
