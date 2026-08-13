import os
from pathlib import Path

from app.config import Settings


class StartupCheckError(RuntimeError):
    """Raised when a required runtime dependency is unavailable."""


def _check_database(database_path: Path) -> None:
    if not database_path.is_file():
        raise StartupCheckError(f"Database file is unavailable: {database_path}")
    if not os.access(database_path, os.R_OK | os.W_OK):
        raise StartupCheckError(f"Database file is not readable and writable: {database_path}")
    if not os.access(database_path.parent, os.W_OK | os.X_OK):
        raise StartupCheckError(
            f"Database directory is not writable and searchable: {database_path.parent}"
        )


def _check_media_root(media_root: Path) -> None:
    if not media_root.is_dir():
        raise StartupCheckError(f"Media root is unavailable: {media_root}")
    if not os.access(media_root, os.R_OK | os.W_OK | os.X_OK):
        raise StartupCheckError(f"Media root is not accessible: {media_root}")


def check_runtime_dependencies(settings: Settings) -> None:
    _check_database(settings.database_path)
    _check_media_root(settings.media_root)
