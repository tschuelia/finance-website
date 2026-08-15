import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path
from secrets import token_hex
from typing import BinaryIO

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Contract, ContractFile, Transaction, User
from app.db.transaction_hooks import register_transaction_callbacks
from app.errors import AuthorizationError, ConflictError, ResourceNotFoundError
from app.services.access import get_visible_contract, get_visible_user, list_visible_contracts
from app.uploads import iter_limited_upload

ZERO = Decimal("0")


@dataclass(frozen=True, slots=True)
class ContractFinancials:
    balance: Decimal
    first_transaction_date: date | None
    last_transaction_date: date | None


@dataclass(frozen=True, slots=True)
class ContractTransactionPage:
    items: tuple[Transaction, ...]
    page: int
    page_size: int
    total: int
    total_pages: int


@dataclass(frozen=True, slots=True)
class ContractDetail:
    contract: Contract
    files: tuple[ContractFile, ...]
    transactions: ContractTransactionPage
    financials: ContractFinancials


@dataclass(frozen=True, slots=True)
class ContractFileReconciliation:
    missing: tuple[str, ...]
    invalid: tuple[str, ...]
    orphaned: tuple[Path, ...]


def _decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def get_contract_financials(
    session: Session,
    current_user: User,
    contract_id: int,
) -> ContractFinancials:
    contract = get_visible_contract(session, current_user, contract_id)
    balance, first_transaction_date, last_transaction_date = session.execute(
        select(
            func.sum(Transaction.amount),
            func.min(Transaction.date_issue),
            func.max(Transaction.date_issue),
        ).where(Transaction.contract_id == contract.id)
    ).one()
    return ContractFinancials(
        balance=_decimal(balance),
        first_transaction_date=first_transaction_date,
        last_transaction_date=last_transaction_date,
    )


def get_contract_detail(
    session: Session,
    current_user: User,
    contract_id: int,
    *,
    page: int = 1,
    page_size: int = 50,
) -> ContractDetail:
    if page < 1:
        raise ValueError("page must be at least 1")
    if page_size < 1 or page_size > 100:
        raise ValueError("page_size must be between 1 and 100")
    contract = get_visible_contract(session, current_user, contract_id)
    transaction_total = (
        session.scalar(
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.contract_id == contract.id)
        )
        or 0
    )
    total_pages = max(1, (transaction_total + page_size - 1) // page_size)
    effective_page = min(page, total_pages)
    return ContractDetail(
        contract=contract,
        files=tuple(
            session.scalars(
                select(ContractFile)
                .where(ContractFile.contract_id == contract.id)
                .order_by(ContractFile.filename, ContractFile.id)
            )
        ),
        transactions=ContractTransactionPage(
            items=tuple(
                session.scalars(
                    select(Transaction)
                    .options(
                        selectinload(Transaction.category),
                        selectinload(Transaction.contract),
                    )
                    .where(Transaction.contract_id == contract.id)
                    .order_by(Transaction.date_issue.desc(), Transaction.id.desc())
                    .offset((effective_page - 1) * page_size)
                    .limit(page_size)
                )
            ),
            page=effective_page,
            page_size=page_size,
            total=transaction_total,
            total_pages=total_pages,
        ),
        financials=get_contract_financials(session, current_user, contract.id),
    )


def grouped_contracts(
    session: Session,
    current_user: User,
) -> tuple[tuple[Contract, ...], tuple[Contract, ...]]:
    contracts = list_visible_contracts(session, current_user)
    return (
        tuple(contract for contract in contracts if contract.is_active),
        tuple(contract for contract in contracts if not contract.is_active),
    )


def _validate_owner(session: Session, current_user: User, owner_id: int) -> User:
    owner = get_visible_user(session, current_user, owner_id)
    if not current_user.is_superuser and owner.id != current_user.id:
        raise AuthorizationError()
    return owner


def create_contract(
    session: Session,
    current_user: User,
    *,
    owner_id: int,
    name: str,
    description: str | None,
    is_active: bool,
    start_date: date | None,
    end_date: date | None,
) -> Contract:
    owner = _validate_owner(session, current_user, owner_id)
    contract = Contract(
        owner_id=owner.id,
        name=name,
        description=description,
        is_active=is_active,
        start_date=start_date,
        end_date=end_date,
    )
    session.add(contract)
    session.flush()
    return contract


def update_contract(
    session: Session,
    current_user: User,
    contract_id: int,
    *,
    owner_id: int,
    name: str,
    description: str | None,
    is_active: bool,
    start_date: date | None,
    end_date: date | None,
) -> Contract:
    contract = get_visible_contract(session, current_user, contract_id)
    owner = _validate_owner(session, current_user, owner_id)
    contract.owner_id = owner.id
    contract.name = name
    contract.description = description
    contract.is_active = is_active
    contract.start_date = start_date
    contract.end_date = end_date
    session.flush()
    return contract


def _media_path(media_root: Path, stored_name: str) -> Path:
    root = media_root.resolve()
    candidate = Path(stored_name.replace("\\", "/"))
    if candidate.is_absolute():
        raise ConflictError("Der gespeicherte Dateipfad ist ungültig.")
    resolved = (root / candidate).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        raise ConflictError("Der gespeicherte Dateipfad ist ungültig.") from None
    return resolved


def resolve_contract_file(
    session: Session,
    current_user: User,
    contract_id: int,
    file_id: int,
    media_root: Path,
) -> tuple[ContractFile, Path]:
    get_visible_contract(session, current_user, contract_id)
    contract_file = session.scalar(
        select(ContractFile).where(
            ContractFile.id == file_id,
            ContractFile.contract_id == contract_id,
        )
    )
    if contract_file is None:
        raise ResourceNotFoundError()
    path = _media_path(media_root, contract_file.file)
    if not path.is_file():
        raise ResourceNotFoundError("Die Vertragsdatei wurde nicht gefunden.")
    return contract_file, path


def _safe_filename(filename: str) -> str:
    display_name = _display_filename(filename)
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", display_name).strip(".-")
    if not safe_name:
        safe_name = "datei"
    # The production-compatible database column stores at most 100 characters.
    # "contract_files/" plus the random token and separator consume 48.
    return safe_name[:52]


def _display_filename(filename: str) -> str:
    if "\x00" in filename:
        raise ConflictError("Der Dateiname ist ungültig.")
    display_name = Path(filename.replace("\\", "/")).name.strip()
    if not display_name or display_name in {".", ".."}:
        raise ConflictError("Der Dateiname ist ungültig.")
    if len(display_name) > 255:
        raise ConflictError("Der Dateiname ist zu lang.")
    return display_name


def store_contract_file(
    session: Session,
    current_user: User,
    contract_id: int,
    media_root: Path,
    *,
    filename: str,
    source: BinaryIO,
    maximum_bytes: int,
) -> ContractFile:
    contract = get_visible_contract(session, current_user, contract_id)
    display_name = _display_filename(filename)
    safe_name = _safe_filename(filename)
    relative_path = Path("contract_files") / f"{token_hex(16)}_{safe_name}"
    destination = _media_path(media_root, relative_path.as_posix())
    staging_path = _media_path(media_root, f".finances-staging/upload-{token_hex(16)}.part")
    staging_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with staging_path.open("xb") as target:
            for chunk in iter_limited_upload(source, maximum_bytes=maximum_bytes):
                target.write(chunk)
        contract_file = ContractFile(
            contract_id=contract.id,
            file=relative_path.as_posix(),
            filename=display_name,
        )
        session.add(contract_file)
        session.flush()
    except Exception:
        staging_path.unlink(missing_ok=True)
        raise

    def finalize_upload() -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        staging_path.replace(destination)

    def discard_upload() -> None:
        staging_path.unlink(missing_ok=True)
        destination.unlink(missing_ok=True)

    register_transaction_callbacks(
        session,
        before_commit=finalize_upload,
        after_rollback=discard_upload,
    )
    return contract_file


def delete_contract_file(
    session: Session,
    current_user: User,
    contract_id: int,
    file_id: int,
    media_root: Path,
) -> None:
    contract_file, path = resolve_contract_file(
        session,
        current_user,
        contract_id,
        file_id,
        media_root,
    )
    staged_path = _media_path(media_root, f".finances-staging/delete-{token_hex(16)}.part")

    def stage_delete() -> None:
        staged_path.parent.mkdir(parents=True, exist_ok=True)
        path.replace(staged_path)

    def finalize_delete() -> None:
        staged_path.unlink(missing_ok=True)

    def restore_delete() -> None:
        if staged_path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            staged_path.replace(path)

    register_transaction_callbacks(
        session,
        before_commit=stage_delete,
        after_commit=finalize_delete,
        after_rollback=restore_delete,
    )
    session.delete(contract_file)
    session.flush()


def reconcile_contract_files(
    session: Session,
    media_root: Path,
) -> ContractFileReconciliation:
    known_paths: set[Path] = set()
    missing: list[str] = []
    invalid: list[str] = []
    for contract_file in session.scalars(select(ContractFile).order_by(ContractFile.id)):
        try:
            path = _media_path(media_root, contract_file.file)
        except ConflictError:
            invalid.append(f"row {contract_file.id}: {contract_file.file}")
            continue
        known_paths.add(path)
        if not path.is_file():
            missing.append(f"row {contract_file.id}: {contract_file.file}")

    candidate_roots = (media_root / "contract_files", media_root / ".finances-staging")
    existing_files = {
        path.resolve()
        for candidate_root in candidate_roots
        if candidate_root.is_dir()
        for path in candidate_root.rglob("*")
        if path.is_file()
    }
    return ContractFileReconciliation(
        missing=tuple(missing),
        invalid=tuple(invalid),
        orphaned=tuple(sorted(existing_files - known_paths)),
    )


def delete_orphaned_contract_files(report: ContractFileReconciliation) -> int:
    deleted = 0
    for path in report.orphaned:
        path.unlink(missing_ok=True)
        deleted += 1
    return deleted
