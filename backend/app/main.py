from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from re import compile as compile_pattern

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import api_router
from app.config import Settings, load_settings
from app.db import create_database_engine, create_session_factory
from app.errors import ServiceUnavailableError, register_exception_handlers
from app.request_logging import RequestLoggingMiddleware, configure_logging
from app.schemas import HealthResponse
from app.security_headers import SecurityHeadersMiddleware
from app.startup import StartupCheckError, check_runtime_dependencies

FRONTEND_INDEX_CACHE_CONTROL = "no-cache, max-age=0, must-revalidate"
STATIC_ASSET_CACHE_CONTROL = "public, max-age=3600"
IMMUTABLE_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable"
HASHED_ASSET_NAME = compile_pattern(r"-[A-Za-z0-9_-]{8,}\.[^.]+$")
RESERVED_BACKEND_PATHS = frozenset({"api", "docs", "health", "openapi.json", "redoc"})


def _frontend_dist_path() -> Path:
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


def _is_reserved_backend_path(path: str) -> bool:
    first_segment = path.split("/", maxsplit=1)[0]
    return first_segment in RESERVED_BACKEND_PATHS


def _static_cache_control(relative_path: Path) -> str:
    if relative_path.name == "index.html":
        return FRONTEND_INDEX_CACHE_CONTROL
    if (
        relative_path.parts
        and relative_path.parts[0] == "assets"
        and HASHED_ASSET_NAME.search(relative_path.name) is not None
    ):
        return IMMUTABLE_ASSET_CACHE_CONTROL
    return STATIC_ASSET_CACHE_CONTROL


def _frontend_file_response(frontend_path: str) -> FileResponse:
    if _is_reserved_backend_path(frontend_path):
        raise HTTPException(status_code=404)

    frontend_dist = _frontend_dist_path()
    frontend_dist = frontend_dist.resolve()
    if not frontend_dist.is_dir():
        raise HTTPException(status_code=404)

    relative_path = Path(frontend_path) if frontend_path else Path("index.html")
    requested_path = (frontend_dist / relative_path).resolve()
    if not requested_path.is_relative_to(frontend_dist) or requested_path.is_dir():
        raise HTTPException(status_code=404)

    if requested_path.is_file():
        return FileResponse(
            requested_path,
            headers={"Cache-Control": _static_cache_control(relative_path)},
        )

    if relative_path.parts and relative_path.parts[0] == "assets":
        raise HTTPException(status_code=404)

    index_path = frontend_dist / "index.html"
    if not index_path.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(
        index_path,
        headers={"Cache-Control": FRONTEND_INDEX_CACHE_CONTROL},
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    application_settings = settings or load_settings()
    configure_logging(development=application_settings.development_logging)
    engine = create_database_engine(application_settings)
    session_factory = create_session_factory(engine)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        # Uvicorn may apply its logging configuration after an app object is imported.
        configure_logging(development=application_settings.development_logging)
        try:
            check_runtime_dependencies(application_settings)
            try:
                with engine.connect() as connection:
                    connection.exec_driver_sql("PRAGMA schema_version").scalar_one()
            except SQLAlchemyError:
                raise StartupCheckError(
                    f"Database could not be opened: {application_settings.database_path}"
                ) from None
            yield
        finally:
            engine.dispose()

    documentation_url = None if application_settings.production_mode else "/docs"
    openapi_url = None if application_settings.production_mode else "/openapi.json"
    redoc_url = None if application_settings.production_mode else "/redoc"
    application = FastAPI(
        title="Finances API",
        lifespan=lifespan,
        docs_url=documentation_url,
        openapi_url=openapi_url,
        redoc_url=redoc_url,
    )
    application.state.settings = application_settings
    application.state.session_factory = session_factory
    register_exception_handlers(application)
    application.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=application_settings.allowed_hosts,
        www_redirect=False,
    )
    application.add_middleware(
        RequestLoggingMiddleware,
        development=application_settings.development_logging,
    )
    application.add_middleware(
        SecurityHeadersMiddleware,
        production=application_settings.production_mode,
    )
    application.include_router(api_router, prefix="/api/v1")

    @application.get("/health/live", response_model=HealthResponse)
    async def liveness() -> HealthResponse:
        return HealthResponse(status="ok")

    @application.get("/health", response_model=HealthResponse)
    async def readiness() -> HealthResponse:
        try:
            check_runtime_dependencies(application_settings)
            with engine.connect() as connection:
                connection.exec_driver_sql("SELECT 1").scalar_one()
        except (StartupCheckError, SQLAlchemyError) as exc:
            raise ServiceUnavailableError() from exc
        return HealthResponse(status="ok")

    @application.api_route(
        "/{frontend_path:path}",
        methods=["GET", "HEAD"],
        include_in_schema=False,
    )
    async def frontend(frontend_path: str) -> FileResponse:
        return _frontend_file_response(frontend_path)

    return application


app = create_app()
