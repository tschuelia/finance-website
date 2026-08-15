from http import HTTPStatus
from typing import Any
from uuid import uuid4

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.request_logging import REQUEST_ID_HEADER
from app.schemas import ProblemDetails, ValidationIssue


class ApplicationError(Exception):
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
    title = "Anfrage fehlgeschlagen"
    problem_type = "urn:finances:error:application"
    default_detail = "Die Anfrage konnte nicht verarbeitet werden."

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.default_detail)
        self.detail = detail or self.default_detail


class AuthenticationError(ApplicationError):
    status_code = HTTPStatus.UNAUTHORIZED
    title = "Authentifizierung erforderlich"
    problem_type = "urn:finances:error:authentication"
    default_detail = "Du musst angemeldet sein, um diese Anfrage auszuführen."


class AuthorizationError(ApplicationError):
    status_code = HTTPStatus.FORBIDDEN
    title = "Zugriff verweigert"
    problem_type = "urn:finances:error:authorization"
    default_detail = "Du bist nicht berechtigt, diese Anfrage auszuführen."


class ResourceNotFoundError(ApplicationError):
    status_code = HTTPStatus.NOT_FOUND
    title = "Nicht gefunden"
    problem_type = "urn:finances:error:not-found"
    default_detail = "Die angeforderte Ressource wurde nicht gefunden."


class ConflictError(ApplicationError):
    status_code = HTTPStatus.CONFLICT
    title = "Konflikt"
    problem_type = "urn:finances:error:conflict"
    default_detail = "Die Anfrage steht im Konflikt mit dem aktuellen Zustand."


class InvalidImportError(ApplicationError):
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY
    title = "CSV-Import fehlgeschlagen"
    problem_type = "urn:finances:error:csv-import"
    default_detail = "Die CSV-Datei konnte nicht verarbeitet werden."


class PayloadTooLargeError(ApplicationError):
    status_code = HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    title = "Datei zu groß"
    problem_type = "urn:finances:error:payload-too-large"
    default_detail = "Die hochgeladene Datei überschreitet die erlaubte Größe."


class LoginRateLimitError(ApplicationError):
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    title = "Zu viele Anmeldeversuche"
    problem_type = "urn:finances:error:login-rate-limit"
    default_detail = "Bitte warte, bevor Du die Anmeldung erneut versuchst."

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__()
        self.retry_after_seconds = retry_after_seconds


class ServiceUnavailableError(ApplicationError):
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    title = "Dienst nicht bereit"
    problem_type = "urn:finances:error:service-unavailable"
    default_detail = "Eine erforderliche Laufzeitabhängigkeit ist nicht verfügbar."


def _request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str):
        return request_id

    request_id = str(uuid4())
    request.state.request_id = request_id
    return request_id


def _problem_response(
    request: Request,
    *,
    status_code: int,
    problem_type: str,
    title: str,
    detail: str,
    errors: list[ValidationIssue] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    request_id = _request_id(request)
    problem = ProblemDetails(
        type=problem_type,
        title=title,
        status=status_code,
        detail=detail,
        instance=request.url.path,
        request_id=request_id,
        errors=errors,
    )
    return JSONResponse(
        status_code=status_code,
        content=problem.model_dump(exclude_none=True),
        media_type="application/problem+json",
        headers={REQUEST_ID_HEADER: request_id} | (headers or {}),
    )


async def application_error_handler(request: Request, exc: ApplicationError) -> JSONResponse:
    return _problem_response(
        request,
        status_code=exc.status_code,
        problem_type=exc.problem_type,
        title=exc.title,
        detail=exc.detail,
        headers=(
            {"Retry-After": str(exc.retry_after_seconds)}
            if isinstance(exc, LoginRateLimitError)
            else None
        ),
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        ValidationIssue(
            location=list(error["loc"]),
            message=error["msg"],
            code=error["type"],
        )
        for error in exc.errors()
    ]
    return _problem_response(
        request,
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
        problem_type="urn:finances:error:validation",
        title="Validierung fehlgeschlagen",
        detail="Die Anfrage enthält ungültige Werte.",
        errors=errors,
    )


def _http_problem(status_code: int) -> tuple[str, str, str]:
    problems: dict[int, tuple[str, str, str]] = {
        HTTPStatus.BAD_REQUEST: (
            "urn:finances:error:bad-request",
            "Ungültige Anfrage",
            "Die Anfrage ist ungültig.",
        ),
        HTTPStatus.UNAUTHORIZED: (
            AuthenticationError.problem_type,
            AuthenticationError.title,
            AuthenticationError.default_detail,
        ),
        HTTPStatus.FORBIDDEN: (
            AuthorizationError.problem_type,
            AuthorizationError.title,
            AuthorizationError.default_detail,
        ),
        HTTPStatus.NOT_FOUND: (
            ResourceNotFoundError.problem_type,
            ResourceNotFoundError.title,
            ResourceNotFoundError.default_detail,
        ),
        HTTPStatus.CONFLICT: (
            ConflictError.problem_type,
            ConflictError.title,
            ConflictError.default_detail,
        ),
        HTTPStatus.REQUEST_ENTITY_TOO_LARGE: (
            PayloadTooLargeError.problem_type,
            PayloadTooLargeError.title,
            PayloadTooLargeError.default_detail,
        ),
        HTTPStatus.TOO_MANY_REQUESTS: (
            LoginRateLimitError.problem_type,
            LoginRateLimitError.title,
            LoginRateLimitError.default_detail,
        ),
        HTTPStatus.SERVICE_UNAVAILABLE: (
            ServiceUnavailableError.problem_type,
            ServiceUnavailableError.title,
            ServiceUnavailableError.default_detail,
        ),
    }
    return problems.get(
        status_code,
        (
            "urn:finances:error:http",
            "Anfrage fehlgeschlagen",
            "Die Anfrage konnte nicht verarbeitet werden.",
        ),
    )


async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
    problem_type, title, default_detail = _http_problem(exc.status_code)
    detail = exc.detail if isinstance(exc.detail, str) else default_detail
    return _problem_response(
        request,
        status_code=exc.status_code,
        problem_type=problem_type,
        title=title,
        detail=detail,
    )


async def unexpected_error_handler(request: Request, _exc: Exception) -> JSONResponse:
    return _problem_response(
        request,
        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        problem_type="urn:finances:error:internal",
        title="Interner Serverfehler",
        detail="Ein unerwarteter Serverfehler ist aufgetreten.",
    )


def register_exception_handlers(app: FastAPI) -> None:
    handlers: list[tuple[type[Exception], Any]] = [
        (ApplicationError, application_error_handler),
        (RequestValidationError, validation_error_handler),
        (HTTPException, http_error_handler),
        (Exception, unexpected_error_handler),
    ]
    for exception_type, handler in handlers:
        app.add_exception_handler(exception_type, handler)
