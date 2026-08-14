from datetime import timedelta

from conftest import add_user
from sqlalchemy.orm import Session

from app.auth.sessions import (
    create_session,
    get_authenticated_session,
    revoke_user_sessions,
    utc_now,
)
from app.cli.management import reset_user_password, set_user_active, set_user_superuser
from app.config import Settings


def test_security_changes_revoke_existing_sessions(session: Session, settings: Settings) -> None:
    user = add_user(session, "owner")

    password_session = create_session(session, settings, user)
    assert reset_user_password(session, user=user, password="replacement").revoked_sessions == 1
    assert get_authenticated_session(session, settings, password_session.token) is None

    active_session = create_session(session, settings, user)
    assert set_user_active(session, user=user, is_active=False).revoked_sessions == 1
    assert get_authenticated_session(session, settings, active_session.token) is None

    set_user_active(session, user=user, is_active=True)
    privilege_session = create_session(session, settings, user)
    assert set_user_superuser(session, user=user, is_superuser=True).revoked_sessions == 1
    assert get_authenticated_session(session, settings, privilege_session.token) is None


def test_expired_sessions_are_not_counted_as_active(session: Session, settings: Settings) -> None:
    user = add_user(session, "owner")
    now = utc_now()
    create_session(session, settings, user, now=now - timedelta(days=30))

    assert revoke_user_sessions(session, user.id, now=now) == 0
