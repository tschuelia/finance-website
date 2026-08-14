from io import BytesIO
from pathlib import Path

import pytest
from conftest import add_contract, add_user
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.db.engine import session_scope
from app.db.models import ContractFile, User
from app.errors import ConflictError, PayloadTooLargeError
from app.services.contracts import (
    delete_contract_file,
    reconcile_contract_files,
    resolve_contract_file,
    store_contract_file,
)


class FailingUpload(BytesIO):
    def read(self, size: int = -1) -> bytes:
        if self.tell() > 0:
            raise OSError("source read failed")
        return super().read(size)


def _create_file(
    session_factory: sessionmaker[Session],
    settings: Settings,
) -> tuple[int, int, Path]:
    with session_scope(session_factory) as session:
        user = add_user(session, "owner")
        contract = add_contract(session, user)
        contract_file = store_contract_file(
            session,
            user,
            contract.id,
            settings.media_root,
            filename="vertrag.pdf",
            source=BytesIO(b"contents"),
            maximum_bytes=8,
        )
        final_path = settings.media_root / contract_file.file
        assert not final_path.exists()
        user_id = user.id
        contract_id = contract.id
    assert final_path.read_bytes() == b"contents"
    return user_id, contract_id, final_path


def test_upload_is_finalized_only_after_commit(
    session_factory: sessionmaker[Session],
    settings: Settings,
) -> None:
    _create_file(session_factory, settings)

    with session_scope(session_factory) as session:
        assert session.scalar(select(func.count()).select_from(ContractFile)) == 1


def test_failed_upload_transaction_removes_staged_and_final_files(
    session_factory: sessionmaker[Session],
    settings: Settings,
) -> None:
    with (
        pytest.raises(RuntimeError, match="late failure"),
        session_scope(session_factory) as session,
    ):
        user = add_user(session, "owner")
        contract = add_contract(session, user)
        contract_file = store_contract_file(
            session,
            user,
            contract.id,
            settings.media_root,
            filename="vertrag.pdf",
            source=BytesIO(b"contents"),
            maximum_bytes=8,
        )
        final_path = settings.media_root / contract_file.file
        raise RuntimeError("late failure")

    assert not final_path.exists()
    assert not any(settings.media_root.rglob("*.part"))
    with session_scope(session_factory) as session:
        assert session.scalar(select(func.count()).select_from(ContractFile)) == 0


def test_oversized_contract_upload_leaves_no_partial_file(
    session_factory: sessionmaker[Session],
    settings: Settings,
) -> None:
    with pytest.raises(PayloadTooLargeError), session_scope(session_factory) as session:
        user = add_user(session, "owner")
        contract = add_contract(session, user)
        store_contract_file(
            session,
            user,
            contract.id,
            settings.media_root,
            filename="vertrag.pdf",
            source=BytesIO(b"too large"),
            maximum_bytes=4,
        )

    assert not any(settings.media_root.rglob("*.part"))


def test_failed_delete_transaction_restores_file_and_row(
    session_factory: sessionmaker[Session],
    settings: Settings,
) -> None:
    user_id, contract_id, final_path = _create_file(session_factory, settings)

    with (
        pytest.raises(RuntimeError, match="late failure"),
        session_scope(session_factory) as session,
    ):
        user = session.get_one(User, user_id)
        contract_file = session.scalar(select(ContractFile))
        assert contract_file is not None
        delete_contract_file(
            session,
            user,
            contract_id,
            contract_file.id,
            settings.media_root,
        )
        raise RuntimeError("late failure")

    assert final_path.read_bytes() == b"contents"
    with session_scope(session_factory) as session:
        assert session.scalar(select(func.count()).select_from(ContractFile)) == 1


def test_upload_write_failure_removes_staging_file(
    session_factory: sessionmaker[Session],
    settings: Settings,
) -> None:
    with (
        pytest.raises(OSError, match="source read failed"),
        session_scope(session_factory) as session,
    ):
        user = add_user(session, "owner")
        contract = add_contract(session, user)
        store_contract_file(
            session,
            user,
            contract.id,
            settings.media_root,
            filename="vertrag.pdf",
            source=FailingUpload(b"contents"),
            maximum_bytes=8,
        )
    assert not any(settings.media_root.rglob("*.part"))


def test_upload_flush_failure_removes_staging_file(
    session_factory: sessionmaker[Session],
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with (
        pytest.raises(RuntimeError, match="flush failed"),
        session_scope(session_factory) as session,
    ):
        user = add_user(session, "owner")
        contract = add_contract(session, user)

        def fail_flush(*_args: object, **_kwargs: object) -> None:
            raise RuntimeError("flush failed")

        monkeypatch.setattr(session, "flush", fail_flush)
        store_contract_file(
            session,
            user,
            contract.id,
            settings.media_root,
            filename="vertrag.pdf",
            source=BytesIO(b"contents"),
            maximum_bytes=8,
        )
    assert not any(settings.media_root.rglob("*.part"))


def test_upload_commit_failure_removes_final_file(
    session_factory: sessionmaker[Session],
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_commit(_session: Session) -> None:
        raise RuntimeError("commit failed")

    monkeypatch.setattr(Session, "commit", fail_commit)
    with (
        pytest.raises(RuntimeError, match="commit failed"),
        session_scope(session_factory) as session,
    ):
        user = add_user(session, "owner")
        contract = add_contract(session, user)
        contract_file = store_contract_file(
            session,
            user,
            contract.id,
            settings.media_root,
            filename="vertrag.pdf",
            source=BytesIO(b"contents"),
            maximum_bytes=8,
        )
        final_path = settings.media_root / contract_file.file

    assert not final_path.exists()
    assert not any(settings.media_root.rglob("*.part"))


def test_upload_rename_failure_rolls_back_row_and_stage(
    session_factory: sessionmaker[Session],
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_replace(_path: Path, _target: Path) -> Path:
        raise OSError("rename failed")

    monkeypatch.setattr(Path, "replace", fail_replace)
    with pytest.raises(OSError, match="rename failed"), session_scope(session_factory) as session:
        user = add_user(session, "owner")
        contract = add_contract(session, user)
        store_contract_file(
            session,
            user,
            contract.id,
            settings.media_root,
            filename="vertrag.pdf",
            source=BytesIO(b"contents"),
            maximum_bytes=8,
        )
    assert not any(settings.media_root.rglob("*.part"))


def test_delete_unlink_failure_is_reported_for_reconciliation(
    session_factory: sessionmaker[Session],
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id, contract_id, _final_path = _create_file(session_factory, settings)
    original_unlink = Path.unlink

    def fail_staged_delete(path: Path, *, missing_ok: bool = False) -> None:
        if path.name.startswith("delete-"):
            raise OSError("unlink failed")
        original_unlink(path, missing_ok=missing_ok)

    monkeypatch.setattr(Path, "unlink", fail_staged_delete)
    with session_scope(session_factory) as session:
        user = session.get_one(User, user_id)
        contract_file = session.scalar(select(ContractFile))
        assert contract_file is not None
        delete_contract_file(
            session,
            user,
            contract_id,
            contract_file.id,
            settings.media_root,
        )

    with session_scope(session_factory) as session:
        assert session.scalar(select(func.count()).select_from(ContractFile)) == 0
        report = reconcile_contract_files(session, settings.media_root)
    assert len(report.orphaned) == 1
    assert report.orphaned[0].name.startswith("delete-")


def test_stored_contract_file_path_cannot_escape_media_root(
    session: Session,
    settings: Settings,
) -> None:
    user = add_user(session, "owner")
    contract = add_contract(session, user)
    contract_file = ContractFile(
        contract_id=contract.id,
        file="../../outside.pdf",
        filename="outside.pdf",
    )
    session.add(contract_file)
    session.flush()

    with pytest.raises(ConflictError, match="Dateipfad"):
        resolve_contract_file(
            session,
            user,
            contract.id,
            contract_file.id,
            settings.media_root,
        )
    report = reconcile_contract_files(session, settings.media_root)
    assert report.invalid == (f"row {contract_file.id}: ../../outside.pdf",)


def test_generated_contract_file_path_fits_production_column(
    session_factory: sessionmaker[Session],
    settings: Settings,
) -> None:
    with session_scope(session_factory) as session:
        user = add_user(session, "owner")
        contract = add_contract(session, user)
        contract_file = store_contract_file(
            session,
            user,
            contract.id,
            settings.media_root,
            filename=f"{'a' * 240}.pdf",
            source=BytesIO(b"contents"),
            maximum_bytes=8,
        )
        assert len(contract_file.file) <= 100
