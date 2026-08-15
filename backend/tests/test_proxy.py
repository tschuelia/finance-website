from fastapi import FastAPI
from starlette.requests import Request

from app.api.auth import _client_ip
from app.config import Settings


def _request(settings: Settings, *, peer: str, forwarded_for: str) -> Request:
    app = FastAPI()
    app.state.settings = settings
    return Request(
        {
            "type": "http",
            "app": app,
            "method": "GET",
            "path": "/api/v1/auth/login",
            "headers": [(b"x-forwarded-for", forwarded_for.encode())],
            "client": (peer, 1234),
            "server": ("testserver", 80),
            "scheme": "http",
            "query_string": b"",
            "root_path": "",
            "http_version": "1.1",
        }
    )


def test_forwarded_client_is_used_only_for_configured_proxy(settings: Settings) -> None:
    trusted_settings = settings.model_copy(update={"trusted_proxy_ips": ["10.0.0.0/24"]})
    assert (
        _client_ip(_request(trusted_settings, peer="10.0.0.2", forwarded_for="192.0.2.10"))
        == "192.0.2.10"
    )
    assert (
        _client_ip(_request(trusted_settings, peer="10.1.0.2", forwarded_for="192.0.2.10"))
        == "10.1.0.2"
    )
    assert (
        _client_ip(_request(trusted_settings, peer="10.0.0.2", forwarded_for="not-an-ip"))
        == "10.0.0.2"
    )
