from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import BankAccount, BankDepot, DepotAsset, Transaction, User
from app.services.access import get_visible_bank_account
from app.services.depots import DepotFinancials

ZERO = Decimal("0")


@dataclass(frozen=True, slots=True)
class AccountFinancials:
    balance: Decimal
    oldest_transaction_date: date
    newest_transaction_date: date
    maximum_absolute_transaction_amount: Decimal


@dataclass(frozen=True, slots=True)
class PortfolioAccount:
    account: BankAccount
    financials: AccountFinancials


@dataclass(frozen=True, slots=True)
class PortfolioDepot:
    depot: BankDepot
    financials: DepotFinancials


@dataclass(frozen=True, slots=True)
class PortfolioGroup:
    owner: User
    accounts: tuple[PortfolioAccount, ...]
    depots: tuple[PortfolioDepot, ...]
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


def get_portfolio_overview(
    session: Session,
    current_user: User,
    *,
    today: date | None = None,
) -> PortfolioOverview:
    user_statement = select(User)
    if not current_user.is_superuser:
        user_statement = user_statement.where(User.id == current_user.id)
    users = tuple(session.scalars(user_statement.order_by(User.id)))

    owner_ids = [user.id for user in users]
    accounts_by_owner: dict[int, list[PortfolioAccount]] = {owner_id: [] for owner_id in owner_ids}
    depots_by_owner: dict[int, list[PortfolioDepot]] = {owner_id: [] for owner_id in owner_ids}
    balances: dict[int, Decimal] = {owner_id: ZERO for owner_id in owner_ids}
    fallback_date = today or date.today()

    if owner_ids:
        for account, transaction_total, oldest_date, newest_date, maximum_amount in session.execute(
            select(
                BankAccount,
                func.sum(Transaction.amount),
                func.min(Transaction.date_issue),
                func.max(Transaction.date_issue),
                func.max(func.abs(Transaction.amount)),
            )
            .outerjoin(Transaction, Transaction.bank_account_id == BankAccount.id)
            .where(BankAccount.owner_id.in_(owner_ids))
            .group_by(BankAccount.id)
            .order_by(BankAccount.id)
        ):
            account_financials = AccountFinancials(
                balance=account.current_amount + _decimal(transaction_total),
                oldest_transaction_date=oldest_date or fallback_date,
                newest_transaction_date=newest_date or fallback_date,
                maximum_absolute_transaction_amount=_decimal(maximum_amount),
            )
            accounts_by_owner[account.owner_id].append(
                PortfolioAccount(account=account, financials=account_financials)
            )
            balances[account.owner_id] += account_financials.balance

        for depot, depot_total, last_update in session.execute(
            select(
                BankDepot,
                func.sum(DepotAsset.current_balance),
                func.max(DepotAsset.last_update),
            )
            .outerjoin(DepotAsset, DepotAsset.bank_depot_id == BankDepot.id)
            .where(BankDepot.owner_id.in_(owner_ids))
            .group_by(BankDepot.id)
            .order_by(BankDepot.id)
        ):
            depot_financials = DepotFinancials(
                balance=_decimal(depot_total),
                last_update=last_update or fallback_date,
            )
            depots_by_owner[depot.owner_id].append(
                PortfolioDepot(depot=depot, financials=depot_financials)
            )
            balances[depot.owner_id] += depot_financials.balance

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
