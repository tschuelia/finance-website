"""Opaque, server-side session primitives."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from hmac import compare_digest, new
from math import ceil
from secrets import token_urlsafe
from typing import TypeGuard

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import ServerSession, User

SESSION_COOKIE_NAME = "finances_session"
CSRF_COOKIE_NAME = "finances_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"
TOKEN_BYTES = 32
MAX_TOKEN_LENGTH = 512


@dataclass(frozen=True, slots=True)
class CreatedSession:
    token: str
    csrf_token: str
    server_session: ServerSession


@dataclass(frozen=True, slots=True)
class AuthenticatedSession:
    user: User
    server_session: ServerSession


def utc_now() -> datetime:
    """Return a naive UTC timestamp, matching Django's SQLite datetime storage."""
    return datetime.now(UTC).replace(tzinfo=None)


def _token_hash(settings: Settings, *, purpose: str, token: str) -> str:
    key = settings.session_secret.get_secret_value().encode("utf-8")
    message = f"{purpose}:{token}".encode()
    return new(key, message, sha256).hexdigest()


def _valid_token(token: str | None) -> TypeGuard[str]:
    return token is not None and 0 < len(token) <= MAX_TOKEN_LENGTH


def hash_session_token(settings: Settings, token: str) -> str:
    return _token_hash(settings, purpose="session", token=token)


def hash_csrf_token(settings: Settings, token: str) -> str:
    return _token_hash(settings, purpose="csrf", token=token)


def cleanup_expired_sessions(session: Session, *, now: datetime | None = None) -> int:
    """Delete sessions that cannot become valid again."""
    result = session.execute(
        delete(ServerSession).where(ServerSession.expires_at <= (now or utc_now()))
    )
    return int(getattr(result, "rowcount", 0) or 0)


def create_session(
    session: Session,
    settings: Settings,
    user: User,
    *,
    now: datetime | None = None,
) -> CreatedSession:
    created_at = now or utc_now()
    token = token_urlsafe(TOKEN_BYTES)
    csrf_token = token_urlsafe(TOKEN_BYTES)
    server_session = ServerSession(
        user_id=user.id,
        token_hash=hash_session_token(settings, token),
        csrf_token_hash=hash_csrf_token(settings, csrf_token),
        created_at=created_at,
        expires_at=created_at + timedelta(seconds=settings.session_lifetime_seconds),
        revoked_at=None,
    )
    cleanup_expired_sessions(session, now=created_at)
    session.add(server_session)
    session.flush()
    return CreatedSession(
        token=token,
        csrf_token=csrf_token,
        server_session=server_session,
    )


def get_authenticated_session(
    session: Session,
    settings: Settings,
    token: str | None,
    *,
    now: datetime | None = None,
) -> AuthenticatedSession | None:
    if not _valid_token(token):
        return None

    server_session = session.scalar(
        select(ServerSession).where(ServerSession.token_hash == hash_session_token(settings, token))
    )
    timestamp = now or utc_now()
    if (
        server_session is None
        or server_session.revoked_at is not None
        or server_session.expires_at <= timestamp
    ):
        return None

    user = session.get(User, server_session.user_id)
    if user is None or not user.is_active:
        return None
    return AuthenticatedSession(user=user, server_session=server_session)


def csrf_token_matches(
    settings: Settings,
    server_session: ServerSession,
    token: str | None,
) -> bool:
    if not _valid_token(token):
        return False
    return compare_digest(
        hash_csrf_token(settings, token),
        server_session.csrf_token_hash,
    )


def ensure_csrf_token(
    session: Session,
    settings: Settings,
    server_session: ServerSession,
    csrf_token: str | None,
) -> str:
    """Reuse a valid browser CSRF token or rotate it when it is absent or stale."""
    if _valid_token(csrf_token) and csrf_token_matches(settings, server_session, csrf_token):
        return csrf_token

    new_csrf_token = token_urlsafe(TOKEN_BYTES)
    server_session.csrf_token_hash = hash_csrf_token(settings, new_csrf_token)
    session.flush()
    return new_csrf_token


def revoke_session(server_session: ServerSession, *, now: datetime | None = None) -> None:
    if server_session.revoked_at is None:
        server_session.revoked_at = now or utc_now()


def session_max_age(server_session: ServerSession, *, now: datetime | None = None) -> int:
    remaining_seconds = (server_session.expires_at - (now or utc_now())).total_seconds()
    return max(1, ceil(remaining_seconds))
