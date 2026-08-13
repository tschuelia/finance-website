from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import api_router
from app.config import Settings, load_settings
from app.db import create_database_engine, create_session_factory
from app.errors import register_exception_handlers
from app.request_logging import RequestLoggingMiddleware, configure_logging
from app.schemas import HealthResponse
from app.startup import StartupCheckError, check_runtime_dependencies


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

    application = FastAPI(title="Finances API", lifespan=lifespan)
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
    application.include_router(api_router, prefix="/api/v1")

    @application.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(status="ok")

    return application


app = create_app()
