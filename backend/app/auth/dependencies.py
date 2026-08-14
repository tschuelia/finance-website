from typing import cast

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.auth.sessions import (
    CSRF_HEADER_NAME,
    SESSION_COOKIE_NAME,
    AuthenticatedSession,
    csrf_token_matches,
    get_authenticated_session,
)
from app.config import Settings
from app.db import request_session
from app.db.models import ServerSession, User
from app.errors import AuthenticationError, AuthorizationError

_AUTHENTICATED_SESSION_STATE_KEY = "finances_authenticated_session"


def get_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def _set_authenticated_session(request: Request, authenticated: AuthenticatedSession) -> None:
    setattr(request.state, _AUTHENTICATED_SESSION_STATE_KEY, authenticated.server_session)


def get_current_server_session(request: Request) -> ServerSession:
    server_session = getattr(request.state, _AUTHENTICATED_SESSION_STATE_KEY, None)
    if not isinstance(server_session, ServerSession):
        raise AuthenticationError()
    return server_session


def get_current_user(
    request: Request,
    session: Session = Depends(request_session),  # noqa: B008
) -> User:
    authenticated = get_authenticated_session(
        session,
        get_settings(request),
        request.cookies.get(SESSION_COOKIE_NAME),
    )
    if authenticated is None:
        raise AuthenticationError()
    _set_authenticated_session(request, authenticated)
    return authenticated.user


def require_csrf(
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
    session: Session = Depends(request_session),  # noqa: B008
) -> User:
    server_session = get_current_server_session(request)
    if not csrf_token_matches(
        get_settings(request),
        server_session,
        request.headers.get(CSRF_HEADER_NAME),
    ):
        raise AuthorizationError("Die CSRF-Prüfung ist fehlgeschlagen.")
    return current_user


def require_superuser_csrf(
    current_user: User = Depends(require_csrf),  # noqa: B008
) -> User:
    if not current_user.is_superuser:
        raise AuthorizationError("Nur Administratoren dürfen globale Kategorien ändern.")
    return current_user
