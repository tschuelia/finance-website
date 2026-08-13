from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import BankAccount, BankDepot, Contract, DepotAsset, Transaction, User
from app.errors import AuthorizationError, ResourceNotFoundError


def _require_owner_or_superuser(current_user: User, owner_id: int) -> None:
    if not current_user.is_superuser and current_user.id != owner_id:
        raise AuthorizationError()


def _require_user(session: Session, user_id: int) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise ResourceNotFoundError()
    return user


def get_visible_user(session: Session, current_user: User, user_id: int) -> User:
    user = _require_user(session, user_id)
    _require_owner_or_superuser(current_user, user.id)
    return user


def list_visible_users(session: Session, current_user: User) -> tuple[User, ...]:
    statement = select(User)
    if not current_user.is_superuser:
        statement = statement.where(User.id == current_user.id)
    return tuple(session.scalars(statement.order_by(User.username, User.id)))


def list_visible_bank_accounts(session: Session, current_user: User) -> tuple[BankAccount, ...]:
    statement = select(BankAccount)
    if not current_user.is_superuser:
        statement = statement.where(BankAccount.owner_id == current_user.id)
    statement = statement.order_by(BankAccount.id)
    return tuple(session.scalars(statement))


def get_visible_bank_account(session: Session, current_user: User, account_id: int) -> BankAccount:
    account = session.get(BankAccount, account_id)
    if account is None:
        raise ResourceNotFoundError()
    _require_owner_or_superuser(current_user, account.owner_id)
    return account


def list_visible_bank_depots(session: Session, current_user: User) -> tuple[BankDepot, ...]:
    statement = select(BankDepot)
    if not current_user.is_superuser:
        statement = statement.where(BankDepot.owner_id == current_user.id)
    statement = statement.order_by(BankDepot.id)
    return tuple(session.scalars(statement))


def get_visible_bank_depot(session: Session, current_user: User, depot_id: int) -> BankDepot:
    depot = session.get(BankDepot, depot_id)
    if depot is None:
        raise ResourceNotFoundError()
    _require_owner_or_superuser(current_user, depot.owner_id)
    return depot


def list_visible_contracts(session: Session, current_user: User) -> tuple[Contract, ...]:
    statement = select(Contract)
    if not current_user.is_superuser:
        statement = statement.where(Contract.owner_id == current_user.id)
    statement = statement.order_by(Contract.owner_id, Contract.name, Contract.id)
    return tuple(session.scalars(statement))


def get_visible_contract(session: Session, current_user: User, contract_id: int) -> Contract:
    contract = session.get(Contract, contract_id)
    if contract is None:
        raise ResourceNotFoundError()
    _require_owner_or_superuser(current_user, contract.owner_id)
    return contract


def get_visible_depot_asset(
    session: Session,
    current_user: User,
    depot_id: int,
    asset_id: int,
) -> DepotAsset:
    get_visible_bank_depot(session, current_user, depot_id)
    asset = session.scalar(
        select(DepotAsset).where(
            DepotAsset.id == asset_id,
            DepotAsset.bank_depot_id == depot_id,
        )
    )
    if asset is None:
        raise ResourceNotFoundError()
    return asset


def get_visible_account_transaction(
    session: Session,
    current_user: User,
    account_id: int,
    transaction_id: int,
) -> Transaction:
    get_visible_bank_account(session, current_user, account_id)
    transaction = session.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.bank_account_id == account_id,
        )
    )
    if transaction is None:
        raise ResourceNotFoundError()
    return transaction
