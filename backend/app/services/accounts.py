from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import BankAccount, BankDepot, DepotAsset, Transaction, User
from app.services.access import get_visible_bank_account

ZERO = Decimal("0")


@dataclass(frozen=True, slots=True)
class AccountFinancials:
    balance: Decimal
    oldest_transaction_date: date
    newest_transaction_date: date
    maximum_absolute_transaction_amount: Decimal


@dataclass(frozen=True, slots=True)
class PortfolioGroup:
    owner: User
    accounts: tuple[BankAccount, ...]
    depots: tuple[BankDepot, ...]
    balance: Decimal


@dataclass(frozen=True, slots=True)
class PortfolioOverview:
    groups: tuple[PortfolioGroup, ...]
    total_balance: Decimal


def _decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def get_account_financials(
    session: Session,
    current_user: User,
    account_id: int,
    *,
    today: date | None = None,
) -> AccountFinancials:
    account = get_visible_bank_account(session, current_user, account_id)
    transaction_total, oldest_date, newest_date, maximum_amount = session.execute(
        select(
            func.sum(Transaction.amount),
            func.min(Transaction.date_issue),
            func.max(Transaction.date_issue),
            func.max(func.abs(Transaction.amount)),
        ).where(Transaction.bank_account_id == account.id)
    ).one()
    fallback_date = today or date.today()
    return AccountFinancials(
        balance=account.current_amount + _decimal(transaction_total),
        oldest_transaction_date=oldest_date or fallback_date,
        newest_transaction_date=newest_date or fallback_date,
        maximum_absolute_transaction_amount=_decimal(maximum_amount),
    )


def _balances_by_owner(session: Session, owner_ids: list[int]) -> dict[int, Decimal]:
    balances: dict[int, Decimal] = {}

    for owner_id, starting_total in session.execute(
        select(BankAccount.owner_id, func.sum(BankAccount.current_amount))
        .where(BankAccount.owner_id.in_(owner_ids))
        .group_by(BankAccount.owner_id)
    ):
        balances[owner_id] = _decimal(starting_total)

    for owner_id, transaction_total in session.execute(
        select(BankAccount.owner_id, func.sum(Transaction.amount))
        .join(Transaction, Transaction.bank_account_id == BankAccount.id)
        .where(BankAccount.owner_id.in_(owner_ids))
        .group_by(BankAccount.owner_id)
    ):
        balances[owner_id] = balances.get(owner_id, ZERO) + _decimal(transaction_total)

    for owner_id, depot_total in session.execute(
        select(BankDepot.owner_id, func.sum(DepotAsset.current_balance))
        .join(DepotAsset, DepotAsset.bank_depot_id == BankDepot.id)
        .where(BankDepot.owner_id.in_(owner_ids))
        .group_by(BankDepot.owner_id)
    ):
        balances[owner_id] = balances.get(owner_id, ZERO) + _decimal(depot_total)

    return balances


def get_portfolio_overview(session: Session, current_user: User) -> PortfolioOverview:
    user_statement = select(User)
    if not current_user.is_superuser:
        user_statement = user_statement.where(User.id == current_user.id)
    users = tuple(session.scalars(user_statement.order_by(User.id)))

    owner_ids = [user.id for user in users]
    accounts_by_owner: dict[int, list[BankAccount]] = {owner_id: [] for owner_id in owner_ids}
    depots_by_owner: dict[int, list[BankDepot]] = {owner_id: [] for owner_id in owner_ids}

    if owner_ids:
        for account in session.scalars(
            select(BankAccount).where(BankAccount.owner_id.in_(owner_ids)).order_by(BankAccount.id)
        ):
            accounts_by_owner[account.owner_id].append(account)
        for depot in session.scalars(
            select(BankDepot).where(BankDepot.owner_id.in_(owner_ids)).order_by(BankDepot.id)
        ):
            depots_by_owner[depot.owner_id].append(depot)

    balances = _balances_by_owner(session, owner_ids)
    groups = tuple(
        PortfolioGroup(
            owner=user,
            accounts=tuple(accounts_by_owner[user.id]),
            depots=tuple(depots_by_owner[user.id]),
            balance=balances.get(user.id, ZERO),
        )
        for user in users
    )
    return PortfolioOverview(
        groups=groups,
        total_balance=sum((group.balance for group in groups), start=ZERO),
    )
