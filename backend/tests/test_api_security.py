from pathlib import Path

import pytest
from conftest import add_account, add_user
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.config import Settings
from app.schemas.imports import CsvCommitRequest


def _login(client: TestClient, username: str, password: str = "test-password") -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return str(response.json()["csrf_token"])


def test_authentication_csrf_logout_and_security_headers(
    app_client: TestClient,
    session: Session,
) -> None:
    add_user(session, "alice")
    session.commit()

    anonymous = app_client.get("/api/v1/accounts")
    assert anonymous.status_code == 401
    assert anonymous.headers["content-type"].startswith("application/problem+json")
    assert anonymous.headers["cache-control"] == "no-store"
    assert anonymous.headers["x-content-type-options"] == "nosniff"

    csrf_token = _login(app_client, "alice")
    assert app_client.get("/api/v1/auth/me").status_code == 200
    assert app_client.post("/api/v1/auth/logout").status_code == 403
    assert (
        app_client.post(
            "/api/v1/auth/logout",
            headers={"X-CSRF-Token": csrf_token},
        ).status_code
        == 204
    )
    assert app_client.get("/api/v1/auth/me").status_code == 401


def test_owner_isolation_applies_to_nested_account_route(
    app_client: TestClient,
    session: Session,
) -> None:
    alice = add_user(session, "alice")
    bob = add_user(session, "bob")
    bob_account = add_account(session, bob)
    account_id = bob_account.id
    session.commit()

    _login(app_client, alice.username)
    response = app_client.get(f"/api/v1/accounts/{account_id}")
    assert response.status_code == 403
    assert response.json()["type"] == "urn:finances:error:authorization"


def test_global_categories_are_readable_but_only_superusers_can_change_them(
    app_client: TestClient,
    session: Session,
) -> None:
    add_user(session, "alice")
    session.commit()
    csrf_token = _login(app_client, "alice")

    assert app_client.get("/api/v1/categories").status_code == 200
    response = app_client.post(
        "/api/v1/categories",
        json={"name": "Global", "patterns": "muster"},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert response.status_code == 403


def test_csv_preview_enforces_streaming_upload_limit(
    app_client: TestClient,
    session: Session,
) -> None:
    user = add_user(session, "alice")
    account = add_account(session, user)
    account_id = account.id
    session.commit()
    _login(app_client, user.username)

    response = app_client.post(
        f"/api/v1/accounts/{account_id}/transactions/import/preview",
        files={"upload": ("transactions.csv", b"x" * 65, "text/csv")},
    )
    assert response.status_code == 413
    assert response.json()["type"] == "urn:finances:error:payload-too-large"


def test_repeated_login_failure_returns_retry_after(
    app_client: TestClient,
    session: Session,
) -> None:
    add_user(session, "alice")
    session.commit()

    first = app_client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "wrong-password"},
    )
    second = app_client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "wrong-password"},
    )
    assert first.status_code == 401
    assert second.status_code == 429
    assert int(second.headers["retry-after"]) >= 1


def test_csv_commit_schema_rejects_more_than_500_rows() -> None:
    row = {
        "bank_account_id": 1,
        "recipient": "Empfänger",
        "amount": 1,
        "subject": "Betreff",
        "date_issue": "2026-08-14",
    }
    with pytest.raises(ValidationError):
        CsvCommitRequest.model_validate({"items": [row] * 501})


def test_production_settings_fail_closed(settings: Settings) -> None:
    with pytest.raises(ValidationError):
        Settings(
            session_secret="test-session-secret-that-is-at-least-32-bytes",
            database_path=settings.database_path,
            media_root=settings.media_root,
            allowed_hosts=["*"],
            development_logging=False,
            cookie_secure=True,
            production_mode=True,
        )


def test_production_docs_headers_and_readiness(
    settings: Settings,
    engine: object,
) -> None:
    from app.main import create_app

    production_settings = settings.model_copy(
        update={
            "cookie_secure": True,
            "production_mode": True,
        }
    )
    with TestClient(create_app(production_settings)) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.headers["content-security-policy"].startswith("default-src 'self'")
        assert response.headers["strict-transport-security"].startswith("max-age=31536000")
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404

        Path(production_settings.media_root).rmdir()
        unavailable = client.get("/health")
        assert unavailable.status_code == 503
        assert client.get("/health/live").status_code == 200
