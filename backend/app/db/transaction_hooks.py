"""Callbacks that coordinate external resources with database transactions."""

import logging
from collections.abc import Callable

from sqlalchemy.orm import Session

TransactionCallback = Callable[[], None]
logger = logging.getLogger(__name__)

_BEFORE_COMMIT = "finances_before_commit_callbacks"
_AFTER_COMMIT = "finances_after_commit_callbacks"
_AFTER_ROLLBACK = "finances_after_rollback_callbacks"


def _callbacks(session: Session, key: str) -> list[TransactionCallback]:
    callbacks = session.info.setdefault(key, [])
    if not isinstance(callbacks, list):
        raise RuntimeError(f"Invalid transaction callback state for {key}")
    return callbacks


def register_transaction_callbacks(
    session: Session,
    *,
    before_commit: TransactionCallback | None = None,
    after_commit: TransactionCallback | None = None,
    after_rollback: TransactionCallback | None = None,
) -> None:
    if before_commit is not None:
        _callbacks(session, _BEFORE_COMMIT).append(before_commit)
    if after_commit is not None:
        _callbacks(session, _AFTER_COMMIT).append(after_commit)
    if after_rollback is not None:
        _callbacks(session, _AFTER_ROLLBACK).append(after_rollback)


def run_before_commit_callbacks(session: Session) -> None:
    for callback in _callbacks(session, _BEFORE_COMMIT):
        callback()


def run_after_commit_callbacks(session: Session) -> None:
    for callback in _callbacks(session, _AFTER_COMMIT):
        try:
            callback()
        except OSError:
            logger.exception("Post-commit resource cleanup failed; reconciliation is required")


def run_after_rollback_callbacks(session: Session) -> None:
    for callback in reversed(_callbacks(session, _AFTER_ROLLBACK)):
        callback()
