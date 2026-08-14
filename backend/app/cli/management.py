from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.sessions import (
    cleanup_expired_sessions,
    revoke_all_active_sessions,
    revoke_user_sessions,
)
from app.db.models import (
    BankAccount,
    BankDepot,
    Contract,
    DepotAsset,
    DepotAssetTransaction,
    Transaction,
    User,
)

MONEY_LIMIT = Decimal("99999999.99")
MONEY_QUANTUM = Decimal("0.01")


class ManagementCommandError(RuntimeError):
    """Raised when a management command cannot safely change the database."""


@dataclass(frozen=True, slots=True)
class UserSummary:
    id: int
    username: str
    is_active: bool
    is_superuser: bool


@dataclass(frozen=True, slots=True)
class UserSecurityUpdate:
    user: UserSummary
    revoked_sessions: int


@dataclass(frozen=True, slots=True)
class AccountSummary:
    id: int
    name: str
    bank: str
    current_amount: Decimal
    owner_id: int
    owner_username: str


@dataclass(frozen=True, slots=True)
class DepotSummary:
    id: int
    name: str
    owner_id: int
    owner_username: str


@dataclass(frozen=True, slots=True)
class AssetSummary:
    id: int
    name: str
    current_balance: Decimal
    bank_depot_id: int | None
    last_update: date


@dataclass(frozen=True, slots=True)
class AssetTransactionSummary:
    id: int
    asset_id: int | None
    amount: Decimal
    date_issue: date


def _required_text(value: str, *, field_name: str, maximum_length: int) -> str:
    if not value:
        raise ManagementCommandError(f"{field_name} must not be empty")
    if value != value.strip():
        raise ManagementCommandError(f"{field_name} must not start or end with whitespace")
    if len(value) > maximum_length:
        raise ManagementCommandError(
            f"{field_name} must be at most {maximum_length} characters long"
        )
    if any(character in value for character in ("\n", "\r", "\t")):
        raise ManagementCommandError(f"{field_name} must not contain control whitespace")
    return value


def _optional_text(value: str, *, field_name: str, maximum_length: int) -> str:
    if len(value) > maximum_length:
        raise ManagementCommandError(
            f"{field_name} must be at most {maximum_length} characters long"
        )
    if any(character in value for character in ("\n", "\r", "\t")):
        raise ManagementCommandError(f"{field_name} must not contain control whitespace")
    return value


def parse_money(value: str, *, field_name: str) -> Decimal:
    try:
        amount = Decimal(value)
    except InvalidOperation:
        raise ManagementCommandError(f"{field_name} must be a decimal amount") from None

    if not amount.is_finite():
        raise ManagementCommandError(f"{field_name} must be a finite decimal amount")
    exponent = amount.as_tuple().exponent
    if not isinstance(exponent, int) or exponent < -2:
        raise ManagementCommandError(f"{field_name} must not have more than two decimal places")
    if abs(amount) > MONEY_LIMIT:
        raise ManagementCommandError(
            f"{field_name} must be between {-MONEY_LIMIT} and {MONEY_LIMIT}"
        )
    return amount.quantize(MONEY_QUANTUM)


def parse_date(value: str, *, field_name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ManagementCommandError(
            f"{field_name} must be an ISO-8601 date (YYYY-MM-DD)"
        ) from None


def _require_exactly_one_identifier(
    *,
    object_name: str,
    identifier: int | None,
    username: str | None,
    identifier_option: str,
    username_option: str,
) -> None:
    if (identifier is None) == (username is None):
        raise ManagementCommandError(
            f"Specify exactly one of {identifier_option} or {username_option} for the {object_name}"
        )


def _require_user_by_id(session: Session, user_id: int) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise ManagementCommandError(f"User {user_id} does not exist")
    return user


def resolve_user(
    session: Session,
    *,
    user_id: int | None,
    username: str | None,
    identifier_option: str = "--user-id",
    username_option: str = "--username",
) -> User:
    _require_exactly_one_identifier(
        object_name="user",
        identifier=user_id,
        username=username,
        identifier_option=identifier_option,
        username_option=username_option,
    )
    if user_id is not None:
        return _require_user_by_id(session, user_id)

    assert username is not None
    user = session.scalar(select(User).where(User.username == username))
    if user is None:
        raise ManagementCommandError(f"User {username!r} does not exist")
    return user


def resolve_owner(
    session: Session,
    *,
    owner_id: int | None,
    owner_username: str | None,
) -> User:
    return resolve_user(
        session,
        user_id=owner_id,
        username=owner_username,
        identifier_option="--owner-id",
        username_option="--owner-username",
    )


def resolve_optional_owner(
    session: Session,
    *,
    owner_id: int | None,
    owner_username: str | None,
) -> User | None:
    if owner_id is None and owner_username is None:
        return None
    return resolve_owner(session, owner_id=owner_id, owner_username=owner_username)


def _hash_password(password: str) -> str:
    if not password:
        raise ManagementCommandError("password must not be empty")

    from app.auth.passwords import hash_password

    return hash_password(password)


def list_users(session: Session) -> tuple[UserSummary, ...]:
    return tuple(
        UserSummary(
            id=user.id,
            username=user.username,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
        )
        for user in session.scalars(select(User).order_by(User.id))
    )


def create_user(
    session: Session,
    *,
    username: str,
    password: str,
    email: str,
    first_name: str,
    last_name: str,
    is_superuser: bool,
) -> UserSummary:
    normalized_username = _required_text(username, field_name="username", maximum_length=150)
    if session.scalar(select(User.id).where(User.username == normalized_username)) is not None:
        raise ManagementCommandError(f"User {normalized_username!r} already exists")

    user = User(
        username=normalized_username,
        password=_hash_password(password),
        email=_optional_text(email, field_name="email", maximum_length=254),
        first_name=_optional_text(first_name, field_name="first name", maximum_length=150),
        last_name=_optional_text(last_name, field_name="last name", maximum_length=150),
        is_active=True,
        is_staff=is_superuser,
        is_superuser=is_superuser,
        last_login=None,
        date_joined=datetime.now(UTC).replace(tzinfo=None),
    )
    session.add(user)
    session.flush()
    return UserSummary(
        id=user.id,
        username=user.username,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
    )


def _user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        username=user.username,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
    )


def reset_user_password(session: Session, *, user: User, password: str) -> UserSecurityUpdate:
    user.password = _hash_password(password)
    revoked_sessions = revoke_user_sessions(session, user.id)
    session.flush()
    return UserSecurityUpdate(
        user=_user_summary(user),
        revoked_sessions=revoked_sessions,
    )


def set_user_active(session: Session, *, user: User, is_active: bool) -> UserSecurityUpdate:
    user.is_active = is_active
    revoked_sessions = revoke_user_sessions(session, user.id) if not is_active else 0
    session.flush()
    return UserSecurityUpdate(
        user=_user_summary(user),
        revoked_sessions=revoked_sessions,
    )


def set_user_superuser(
    session: Session,
    *,
    user: User,
    is_superuser: bool,
) -> UserSecurityUpdate:
    user.is_superuser = is_superuser
    user.is_staff = is_superuser
    revoked_sessions = revoke_user_sessions(session, user.id)
    session.flush()
    return UserSecurityUpdate(
        user=_user_summary(user),
        revoked_sessions=revoked_sessions,
    )


def revoke_sessions_for_user(session: Session, *, user: User) -> UserSecurityUpdate:
    revoked_sessions = revoke_user_sessions(session, user.id)
    session.flush()
    return UserSecurityUpdate(
        user=_user_summary(user),
        revoked_sessions=revoked_sessions,
    )


def revoke_every_session(session: Session) -> int:
    revoked_sessions = revoke_all_active_sessions(session)
    session.flush()
    return revoked_sessions


def cleanup_sessions(session: Session) -> int:
    deleted_sessions = cleanup_expired_sessions(session)
    session.flush()
    return deleted_sessions


def _account_summary(account: BankAccount, owner_username: str) -> AccountSummary:
    return AccountSummary(
        id=account.id,
        name=account.name,
        bank=account.bank,
        current_amount=account.current_amount,
        owner_id=account.owner_id,
        owner_username=owner_username,
    )


def list_accounts(session: Session, *, owner: User | None = None) -> tuple[AccountSummary, ...]:
    statement = select(BankAccount, User.username).join(User, BankAccount.owner_id == User.id)
    if owner is not None:
        statement = statement.where(BankAccount.owner_id == owner.id)
    return tuple(
        _account_summary(account, owner_username)
        for account, owner_username in session.execute(statement.order_by(BankAccount.id))
    )


def _require_account(session: Session, account_id: int) -> BankAccount:
    account = session.get(BankAccount, account_id)
    if account is None:
        raise ManagementCommandError(f"Account {account_id} does not exist")
    return account


def create_account(
    session: Session,
    *,
    name: str,
    bank: str,
    current_amount: str,
    owner: User,
) -> AccountSummary:
    account = BankAccount(
        name=_required_text(name, field_name="account name", maximum_length=255),
        bank=_required_text(bank, field_name="bank", maximum_length=255),
        current_amount=parse_money(current_amount, field_name="current amount"),
        owner_id=owner.id,
    )
    session.add(account)
    session.flush()
    return _account_summary(account, owner.username)


def update_account(
    session: Session,
    *,
    account_id: int,
    name: str | None,
    bank: str | None,
    current_amount: str | None,
    owner: User | None,
) -> AccountSummary:
    if all(value is None for value in (name, bank, current_amount, owner)):
        raise ManagementCommandError("Specify at least one account field to update")
    account = _require_account(session, account_id)
    if name is not None:
        account.name = _required_text(name, field_name="account name", maximum_length=255)
    if bank is not None:
        account.bank = _required_text(bank, field_name="bank", maximum_length=255)
    if current_amount is not None:
        account.current_amount = parse_money(current_amount, field_name="current amount")
    if owner is not None:
        mismatched_contract = session.scalar(
            select(Contract.id)
            .join(Transaction, Transaction.contract_id == Contract.id)
            .where(
                Transaction.bank_account_id == account.id,
                Contract.owner_id != owner.id,
            )
            .limit(1)
        )
        if mismatched_contract is not None:
            raise ManagementCommandError(
                "account owner cannot change while linked contracts have another owner"
            )
        account.owner_id = owner.id
    session.flush()
    owner_username = owner.username if owner is not None else account.owner.username
    return _account_summary(account, owner_username)


def _depot_summary(depot: BankDepot, owner_username: str) -> DepotSummary:
    return DepotSummary(
        id=depot.id,
        name=depot.name,
        owner_id=depot.owner_id,
        owner_username=owner_username,
    )


def list_depots(session: Session, *, owner: User | None = None) -> tuple[DepotSummary, ...]:
    statement = select(BankDepot, User.username).join(User, BankDepot.owner_id == User.id)
    if owner is not None:
        statement = statement.where(BankDepot.owner_id == owner.id)
    return tuple(
        _depot_summary(depot, owner_username)
        for depot, owner_username in session.execute(statement.order_by(BankDepot.id))
    )


def _require_depot(session: Session, depot_id: int) -> BankDepot:
    depot = session.get(BankDepot, depot_id)
    if depot is None:
        raise ManagementCommandError(f"Depot {depot_id} does not exist")
    return depot


def create_depot(session: Session, *, name: str, owner: User) -> DepotSummary:
    depot = BankDepot(
        name=_required_text(name, field_name="depot name", maximum_length=255),
        owner_id=owner.id,
    )
    session.add(depot)
    session.flush()
    return _depot_summary(depot, owner.username)


def update_depot(
    session: Session,
    *,
    depot_id: int,
    name: str | None,
    owner: User | None,
) -> DepotSummary:
    if name is None and owner is None:
        raise ManagementCommandError("Specify at least one depot field to update")
    depot = _require_depot(session, depot_id)
    if name is not None:
        depot.name = _required_text(name, field_name="depot name", maximum_length=255)
    if owner is not None:
        depot.owner_id = owner.id
    session.flush()
    owner_username = owner.username if owner is not None else depot.owner.username
    return _depot_summary(depot, owner_username)


def _asset_summary(asset: DepotAsset) -> AssetSummary:
    return AssetSummary(
        id=asset.id,
        name=asset.name,
        current_balance=asset.current_balance,
        bank_depot_id=asset.bank_depot_id,
        last_update=asset.last_update,
    )


def _require_asset(session: Session, asset_id: int) -> DepotAsset:
    asset = session.get(DepotAsset, asset_id)
    if asset is None:
        raise ManagementCommandError(f"Asset {asset_id} does not exist")
    return asset


def create_asset(
    session: Session,
    *,
    name: str,
    current_balance: str,
    last_update: str,
    depot_id: int,
) -> AssetSummary:
    _require_depot(session, depot_id)
    asset = DepotAsset(
        name=_required_text(name, field_name="asset name", maximum_length=255),
        current_balance=parse_money(current_balance, field_name="current balance"),
        last_update=parse_date(last_update, field_name="last update"),
        bank_depot_id=depot_id,
    )
    session.add(asset)
    session.flush()
    return _asset_summary(asset)


def update_asset(
    session: Session,
    *,
    asset_id: int,
    name: str | None,
    current_balance: str | None,
    last_update: str | None,
    depot_id: int | None,
) -> AssetSummary:
    if all(value is None for value in (name, current_balance, last_update, depot_id)):
        raise ManagementCommandError("Specify at least one asset field to update")
    asset = _require_asset(session, asset_id)
    if name is not None:
        asset.name = _required_text(name, field_name="asset name", maximum_length=255)
    if current_balance is not None:
        asset.current_balance = parse_money(current_balance, field_name="current balance")
    if last_update is not None:
        asset.last_update = parse_date(last_update, field_name="last update")
    if depot_id is not None:
        _require_depot(session, depot_id)
        asset.bank_depot_id = depot_id
    session.flush()
    return _asset_summary(asset)


def _asset_transaction_summary(transaction: DepotAssetTransaction) -> AssetTransactionSummary:
    return AssetTransactionSummary(
        id=transaction.id,
        asset_id=transaction.asset_id,
        amount=transaction.amount,
        date_issue=transaction.date_issue,
    )


def create_asset_transaction(
    session: Session,
    *,
    asset_id: int,
    amount: str,
    date_issue: str,
) -> AssetTransactionSummary:
    _require_asset(session, asset_id)
    transaction = DepotAssetTransaction(
        asset_id=asset_id,
        amount=parse_money(amount, field_name="amount"),
        date_issue=parse_date(date_issue, field_name="date issue"),
    )
    session.add(transaction)
    session.flush()
    return _asset_transaction_summary(transaction)


def delete_asset_transaction(session: Session, *, transaction_id: int) -> AssetTransactionSummary:
    transaction = session.get(DepotAssetTransaction, transaction_id)
    if transaction is None:
        raise ManagementCommandError(f"Asset transaction {transaction_id} does not exist")
    summary = _asset_transaction_summary(transaction)
    session.delete(transaction)
    session.flush()
    return summary


def user_summary_line(summary: UserSummary) -> str:
    return (
        f"id={summary.id} username={summary.username!r} "
        f"active={'yes' if summary.is_active else 'no'} "
        f"superuser={'yes' if summary.is_superuser else 'no'}"
    )


def user_security_update_line(update: UserSecurityUpdate) -> str:
    return f"{user_summary_line(update.user)} revoked_sessions={update.revoked_sessions}"


def account_summary_line(summary: AccountSummary) -> str:
    return (
        f"id={summary.id} name={summary.name!r} bank={summary.bank!r} "
        f"current_amount={summary.current_amount} owner_id={summary.owner_id} "
        f"owner_username={summary.owner_username!r}"
    )


def depot_summary_line(summary: DepotSummary) -> str:
    return (
        f"id={summary.id} name={summary.name!r} owner_id={summary.owner_id} "
        f"owner_username={summary.owner_username!r}"
    )


def asset_summary_line(summary: AssetSummary) -> str:
    return (
        f"id={summary.id} name={summary.name!r} current_balance={summary.current_balance} "
        f"depot_id={summary.bank_depot_id} last_update={summary.last_update.isoformat()}"
    )


def asset_transaction_summary_line(summary: AssetTransactionSummary) -> str:
    return (
        f"id={summary.id} asset_id={summary.asset_id} amount={summary.amount} "
        f"date_issue={summary.date_issue.isoformat()}"
    )


def lines_for_summaries(summaries: Sequence[object]) -> tuple[str, ...]:
    lines: list[str] = []
    for summary in summaries:
        if isinstance(summary, UserSummary):
            lines.append(user_summary_line(summary))
        elif isinstance(summary, AccountSummary):
            lines.append(account_summary_line(summary))
        elif isinstance(summary, DepotSummary):
            lines.append(depot_summary_line(summary))
        elif isinstance(summary, AssetSummary):
            lines.append(asset_summary_line(summary))
        elif isinstance(summary, AssetTransactionSummary):
            lines.append(asset_transaction_summary_line(summary))
        else:
            raise TypeError(f"Unsupported management summary: {type(summary)!r}")
    return tuple(lines)
