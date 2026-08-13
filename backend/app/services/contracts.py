import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path
from secrets import token_hex
from typing import BinaryIO

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Contract, ContractFile, Transaction, User
from app.errors import AuthorizationError, ConflictError, ResourceNotFoundError
from app.services.access import get_visible_contract, get_visible_user, list_visible_contracts

ZERO = Decimal("0")


@dataclass(frozen=True, slots=True)
class ContractFinancials:
    balance: Decimal
    first_transaction: Transaction | None
    last_transaction: Transaction | None


@dataclass(frozen=True, slots=True)
class ContractDetail:
    contract: Contract
    files: tuple[ContractFile, ...]
    transactions: tuple[Transaction, ...]
    financials: ContractFinancials


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
    balance = session.scalar(
        select(func.sum(Transaction.amount)).where(Transaction.contract_id == contract.id)
    )
    first_transaction = session.scalar(
        select(Transaction)
        .where(Transaction.contract_id == contract.id)
        .order_by(Transaction.date_issue, Transaction.id.desc())
        .limit(1)
    )
    last_transaction = session.scalar(
        select(Transaction)
        .where(Transaction.contract_id == contract.id)
        .order_by(Transaction.date_issue.desc(), Transaction.id)
        .limit(1)
    )
    return ContractFinancials(
        balance=_decimal(balance),
        first_transaction=first_transaction,
        last_transaction=last_transaction,
    )


def get_contract_detail(
    session: Session,
    current_user: User,
    contract_id: int,
) -> ContractDetail:
    contract = get_visible_contract(session, current_user, contract_id)
    return ContractDetail(
        contract=contract,
        files=tuple(
            session.scalars(
                select(ContractFile)
                .where(ContractFile.contract_id == contract.id)
                .order_by(ContractFile.filename, ContractFile.id)
            )
        ),
        transactions=tuple(
            session.scalars(
                select(Transaction)
                .where(Transaction.contract_id == contract.id)
                .order_by(Transaction.date_issue.desc(), Transaction.id.desc())
            )
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
    return safe_name[:120]


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
) -> ContractFile:
    contract = get_visible_contract(session, current_user, contract_id)
    display_name = _display_filename(filename)
    safe_name = _safe_filename(filename)
    relative_path = Path("contract_files") / f"{token_hex(16)}_{safe_name}"
    destination = _media_path(media_root, relative_path.as_posix())
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with destination.open("xb") as target:
            while chunk := source.read(1024 * 1024):
                target.write(chunk)
        contract_file = ContractFile(
            contract_id=contract.id,
            file=relative_path.as_posix(),
            filename=display_name,
        )
        session.add(contract_file)
        session.flush()
    except Exception:
        destination.unlink(missing_ok=True)
        raise
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
    path.unlink(missing_ok=True)
    session.delete(contract_file)
    session.flush()
