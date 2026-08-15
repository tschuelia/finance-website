from datetime import datetime
from ipaddress import ip_address, ip_network
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    get_current_server_session,
    get_current_user,
    get_settings,
    require_csrf,
)
from app.auth.service import authenticate_user
from app.auth.sessions import (
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    create_session,
    ensure_csrf_token,
    revoke_session,
    session_max_age,
    utc_now,
)
from app.auth.throttle import login_throttle
from app.db import request_session
from app.db.models import User
from app.errors import AuthenticationError, LoginRateLimitError
from app.schemas.auth import AuthenticatedUserResponse, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    direct_client = request.client.host if request.client is not None else None
    settings = get_settings(request)
    try:
        direct_address = ip_address(direct_client) if direct_client is not None else None
    except ValueError:
        return direct_client
    if direct_address is None or not any(
        direct_address in ip_network(proxy, strict=False) for proxy in settings.trusted_proxy_ips
    ):
        return direct_client

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for is None:
        return direct_client
    forwarded_client = forwarded_for.split(",", maxsplit=1)[0].strip()
    try:
        return str(ip_address(forwarded_client))
    except ValueError:
        return direct_client


def _authenticated_user_response(
    user: User,
    *,
    csrf_token: str,
    expires_at: datetime,
) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_superuser=user.is_superuser,
        csrf_token=csrf_token,
        expires_at=expires_at,
    )


def _set_auth_cookies(
    response: Response,
    *,
    session_token: str,
    csrf_token: str,
    max_age: int,
    secure: bool,
) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=max_age,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
    )


def _delete_auth_cookies(response: Response, *, secure: bool) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.delete_cookie(
        key=CSRF_COOKIE_NAME,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=AuthenticatedUserResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: Annotated[Session, Depends(request_session)],
) -> AuthenticatedUserResponse:
    throttle_key = login_throttle.attempt_key(
        client_host=_client_ip(request),
        username=payload.username,
    )
    delay_seconds = login_throttle.delay_seconds(throttle_key)
    if delay_seconds > 0:
        raise LoginRateLimitError(login_throttle.retry_after_seconds(throttle_key))

    user = authenticate_user(session, payload.username, payload.password)
    if user is None:
        login_throttle.register_failure(throttle_key)
        raise AuthenticationError("Benutzername oder Passwort ist ungültig.")

    login_throttle.register_success(throttle_key)
    now = utc_now()
    user.last_login = now
    created_session = create_session(session, get_settings(request), user, now=now)
    _set_auth_cookies(
        response,
        session_token=created_session.token,
        csrf_token=created_session.csrf_token,
        max_age=session_max_age(created_session.server_session, now=now),
        secure=get_settings(request).cookie_secure,
    )
    return _authenticated_user_response(
        user,
        csrf_token=created_session.csrf_token,
        expires_at=created_session.server_session.expires_at,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    current_user: Annotated[User, Depends(require_csrf)],
    session: Annotated[Session, Depends(request_session)],
) -> None:
    server_session = get_current_server_session(request)
    if server_session.user_id != current_user.id:
        raise AuthenticationError()
    revoke_session(server_session)
    _delete_auth_cookies(response, secure=get_settings(request).cookie_secure)


@router.get("/me", response_model=AuthenticatedUserResponse)
def me(
    request: Request,
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(request_session)],
) -> AuthenticatedUserResponse:
    server_session = get_current_server_session(request)
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token is None:
        raise AuthenticationError()
    csrf_token = ensure_csrf_token(
        session,
        get_settings(request),
        server_session,
        request.cookies.get(CSRF_COOKIE_NAME),
    )
    _set_auth_cookies(
        response,
        session_token=session_token,
        csrf_token=csrf_token,
        max_age=session_max_age(server_session),
        secure=get_settings(request).cookie_secure,
    )
    return _authenticated_user_response(
        current_user,
        csrf_token=csrf_token,
        expires_at=server_session.expires_at,
    )
