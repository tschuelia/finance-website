import json
import logging
import sys
from datetime import UTC, datetime
from time import perf_counter
from typing import ClassVar
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

LOGGER_NAME = "finances"
REQUEST_ID_HEADER = "X-Request-ID"


class JsonFormatter(logging.Formatter):
    extra_fields: ClassVar[tuple[str, ...]] = (
        "request_id",
        "method",
        "path",
        "status",
        "duration_ms",
        "exception_type",
    )

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname.lower(),
            "event": record.getMessage(),
        }
        for field in self.extra_fields:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        return json.dumps(payload, separators=(",", ":"))


def configure_logging(*, development: bool) -> None:
    logger = logging.getLogger(LOGGER_NAME)
    logger.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG if development else logging.INFO)
    logger.propagate = False

    logging.getLogger("uvicorn.access").disabled = True


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, development: bool) -> None:
        super().__init__(app)
        self.log_level = logging.DEBUG if development else logging.INFO
        self.logger = logging.getLogger(LOGGER_NAME)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid4())
        request.state.request_id = request_id
        started_at = perf_counter()
        handled_unexpected_error = False

        try:
            response = await call_next(request)
        except Exception as exc:
            from app.errors import unexpected_error_handler

            handled_unexpected_error = True
            self._log_request(
                request=request,
                request_id=request_id,
                status_code=500,
                started_at=started_at,
                exception_type=type(exc).__name__,
            )
            response = await unexpected_error_handler(request, exc)

        response.headers[REQUEST_ID_HEADER] = request_id
        if not handled_unexpected_error:
            self._log_request(
                request=request,
                request_id=request_id,
                status_code=response.status_code,
                started_at=started_at,
            )
        return response

    def _log_request(
        self,
        *,
        request: Request,
        request_id: str,
        status_code: int,
        started_at: float,
        exception_type: str | None = None,
    ) -> None:
        self.logger.log(
            logging.ERROR if exception_type is not None else self.log_level,
            "request_completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": status_code,
                "duration_ms": round((perf_counter() - started_at) * 1000, 2),
                "exception_type": exception_type,
            },
        )
