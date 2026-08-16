import statistics
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db.models import BankAccount, Category, Contract, Transaction, User
from app.services.dashboard_common import ZERO, decimal_value, month_count, month_end, shift_month
from app.services.dashboard_models import (
    AccountCashFlow,
    CategoryCashFlow,
    CategoryChange,
    CategoryMonth,
    ContractExpense,
    ContractMonth,
    DashboardPeriod,
    SpendingAnomaly,
)
from app.services.transfers import confirmed_transfer_transaction_subquery

UNCATEGORIZED = "Ohne Kategorie"


@dataclass(frozen=True, slots=True)
class CategoryBreakdown:
    items: tuple[CategoryCashFlow, ...]
    monthly: tuple[CategoryMonth, ...]
    month_values: dict[tuple[int | None, str, str], Decimal]
    names: dict[int | None, str]


@dataclass(frozen=True, slots=True)
class ContractBreakdown:
    items: tuple[ContractExpense, ...]
    monthly: tuple[ContractMonth, ...]
    total: Decimal


@dataclass(frozen=True, slots=True)
class SpendingInsights:
    anomalies: tuple[SpendingAnomaly, ...]
    increases: tuple[CategoryChange, ...]
    decreases: tuple[CategoryChange, ...]


def account_breakdown(
    session: Session,
    accounts: tuple[BankAccount, ...],
    selected_ids: tuple[int, ...],
    period_start: date,
    period_end: date,
) -> tuple[AccountCashFlow, ...]:
    confirmed_ids = confirmed_transfer_transaction_subquery()
    account_rows = session.execute(
        select(
            BankAccount.id,
            func.sum(case((Transaction.amount > ZERO, Transaction.amount), else_=ZERO)),
            func.sum(case((Transaction.amount < ZERO, -Transaction.amount), else_=ZERO)),
        )
        .join(Transaction, Transaction.bank_account_id == BankAccount.id)
        .where(
            Transaction.bank_account_id.in_(selected_ids),
            Transaction.date_issue.between(period_start, month_end(period_end)),
            Transaction.id.not_in(select(confirmed_ids.c.transaction_id)),
        )
        .group_by(BankAccount.id)
    )
    account_values = {
        int(account_id): (decimal_value(income), decimal_value(expense))
        for account_id, income, expense in account_rows
    }
    owner_ids = {account.owner_id for account in accounts}
    owners = {
        user.id: user.username
        for user in session.scalars(select(User).where(User.id.in_(owner_ids)))
    }
    return tuple(
        AccountCashFlow(
            account_id=account.id,
            account_name=account.name,
            owner_name=owners.get(account.owner_id, ""),
            income=account_values.get(account.id, (ZERO, ZERO))[0],
            expense=account_values.get(account.id, (ZERO, ZERO))[1],
            net=(
                account_values.get(account.id, (ZERO, ZERO))[0]
                - account_values.get(account.id, (ZERO, ZERO))[1]
            ),
        )
        for account in accounts
    )


def _category_total(
    values: dict[tuple[int | None, str, str], Decimal],
    category_id: int | None,
    name: str,
    start: date,
    count: int,
) -> Decimal:
    return sum(
        (
            values.get(
                (category_id, name, shift_month(start, offset).strftime("%Y-%m")),
                ZERO,
            )
            for offset in range(count)
        ),
        start=ZERO,
    )


def category_breakdown(
    session: Session,
    selected_ids: tuple[int, ...],
    *,
    scan_start: date,
    scan_end: date,
    period: DashboardPeriod,
    comparison_period: DashboardPeriod,
    period_start: date,
    comparison_start: date,
    expense: Decimal,
    previous_expense: Decimal,
) -> CategoryBreakdown:
    confirmed_ids = confirmed_transfer_transaction_subquery()
    period_column = func.strftime("%Y-%m", Transaction.date_issue)
    category_name = func.coalesce(Category.name, UNCATEGORIZED)
    rows = session.execute(
        select(
            Transaction.category_id,
            category_name,
            period_column,
            func.sum(case((Transaction.amount < ZERO, -Transaction.amount), else_=ZERO)),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.bank_account_id.in_(selected_ids),
            Transaction.date_issue.between(scan_start, scan_end),
            Transaction.id.not_in(select(confirmed_ids.c.transaction_id)),
        )
        .group_by(Transaction.category_id, category_name, period_column)
    )
    month_values: dict[tuple[int | None, str, str], Decimal] = {}
    names: dict[int | None, str] = {}
    for category_id, name, month, amount in rows:
        identifier = int(category_id) if category_id is not None else None
        names[identifier] = str(name)
        month_values[(identifier, str(name), str(month))] = decimal_value(amount)

    totals: list[CategoryCashFlow] = []
    for category_id, name in names.items():
        current_amount = _category_total(
            month_values,
            category_id,
            name,
            period_start,
            period.month_count,
        )
        previous_amount = _category_total(
            month_values,
            category_id,
            name,
            comparison_start,
            comparison_period.month_count,
        )
        if current_amount != ZERO or previous_amount != ZERO:
            totals.append(
                CategoryCashFlow(
                    category_id=category_id,
                    category=name,
                    expense=current_amount,
                    previous_expense=previous_amount,
                    share=current_amount / expense if expense > ZERO else ZERO,
                    previous_share=(
                        previous_amount / previous_expense if previous_expense > ZERO else ZERO
                    ),
                )
            )
    items = tuple(sorted(totals, key=lambda item: (-item.expense, item.category.casefold())))
    monthly = tuple(
        CategoryMonth(
            period=month.strftime("%Y-%m"),
            category_id=category.category_id,
            category=category.category,
            expense=month_values.get(
                (category.category_id, category.category, month.strftime("%Y-%m")),
                ZERO,
            ),
        )
        for offset in range(period.month_count)
        for month in (shift_month(period_start, offset),)
        for category in items
        if month_values.get(
            (category.category_id, category.category, month.strftime("%Y-%m")),
            ZERO,
        )
        > ZERO
    )
    return CategoryBreakdown(items=items, monthly=monthly, month_values=month_values, names=names)


def contract_breakdown(
    session: Session,
    selected_ids: tuple[int, ...],
    period: DashboardPeriod,
    period_start: date,
    period_end: date,
    expense: Decimal,
) -> ContractBreakdown:
    confirmed_ids = confirmed_transfer_transaction_subquery()
    period_column = func.strftime("%Y-%m", Transaction.date_issue)
    rows = session.execute(
        select(
            Contract.id,
            Contract.name,
            User.username,
            Contract.is_active,
            period_column,
            func.sum(-Transaction.amount),
        )
        .join(Transaction, Transaction.contract_id == Contract.id)
        .join(User, Contract.owner_id == User.id)
        .where(
            Transaction.bank_account_id.in_(selected_ids),
            Transaction.date_issue.between(period_start, month_end(period_end)),
            Transaction.amount < ZERO,
            Transaction.id.not_in(select(confirmed_ids.c.transaction_id)),
        )
        .group_by(
            Contract.id,
            Contract.name,
            User.username,
            Contract.is_active,
            period_column,
        )
    )
    metadata: dict[int, tuple[str, str, bool]] = {}
    totals: dict[int, Decimal] = {}
    month_values: dict[tuple[str, int], Decimal] = {}
    for contract_id, name, owner, is_active, month, amount in rows:
        identifier = int(contract_id)
        value = decimal_value(amount)
        metadata[identifier] = (str(name), str(owner), bool(is_active))
        totals[identifier] = totals.get(identifier, ZERO) + value
        month_values[(str(month), identifier)] = value
    items = tuple(
        sorted(
            (
                ContractExpense(
                    contract_id=contract_id,
                    contract_name=metadata[contract_id][0],
                    owner_name=metadata[contract_id][1],
                    is_active=metadata[contract_id][2],
                    expense=amount,
                    monthly_average=amount / Decimal(period.month_count),
                    share=amount / expense if expense > ZERO else ZERO,
                )
                for contract_id, amount in totals.items()
            ),
            key=lambda item: (-item.expense, item.contract_name.casefold(), item.contract_id),
        )
    )
    monthly = tuple(
        ContractMonth(period=month, contract_id=contract_id, expense=amount)
        for (month, contract_id), amount in sorted(month_values.items())
    )
    return ContractBreakdown(
        items=items,
        monthly=monthly,
        total=sum((item.expense for item in items), start=ZERO),
    )


def spending_insights(
    session: Session,
    selected_ids: tuple[int, ...],
    categories: CategoryBreakdown,
    *,
    period: DashboardPeriod,
    comparison_period: DashboardPeriod,
    period_end: date,
    current_day: date,
) -> SpendingInsights:
    target = min(period_end, shift_month(current_day.replace(day=1), -1))
    oldest_transaction = session.scalar(
        select(func.min(Transaction.date_issue)).where(
            Transaction.bank_account_id.in_(selected_ids)
        )
    )
    history_months = max(
        0,
        min(
            6,
            month_count(
                oldest_transaction.replace(day=1) if oldest_transaction is not None else target,
                shift_month(target, -1),
            ),
        ),
    )
    anomalies: list[SpendingAnomaly] = []
    if history_months >= 3:
        for category_id, name in categories.names.items():
            target_amount = categories.month_values.get(
                (category_id, name, target.strftime("%Y-%m")),
                ZERO,
            )
            baseline_values = [
                categories.month_values.get(
                    (category_id, name, shift_month(target, -offset).strftime("%Y-%m")),
                    ZERO,
                )
                for offset in range(1, history_months + 1)
            ]
            baseline = decimal_value(statistics.median(baseline_values))
            difference = target_amount - baseline
            if difference >= Decimal("50") and (
                baseline == ZERO or target_amount >= baseline * Decimal("1.5")
            ):
                anomalies.append(
                    SpendingAnomaly(
                        period=target.strftime("%Y-%m"),
                        category_id=category_id,
                        category=name,
                        expense=target_amount,
                        baseline_median=baseline,
                        absolute_change=difference,
                        percentage_change=None if baseline == ZERO else difference / baseline,
                    )
                )
    anomalies.sort(key=lambda item: (-item.absolute_change, item.category.casefold()))
    changes = [
        CategoryChange(
            category_id=item.category_id,
            category=item.category,
            monthly_average=item.expense / Decimal(period.month_count),
            previous_monthly_average=item.previous_expense / Decimal(comparison_period.month_count),
            absolute_change=(
                item.expense / Decimal(period.month_count)
                - item.previous_expense / Decimal(comparison_period.month_count)
            ),
            percentage_change=(
                None
                if item.previous_expense == ZERO
                else (item.expense - item.previous_expense) / item.previous_expense
            ),
        )
        for item in categories.items
    ]
    return SpendingInsights(
        anomalies=tuple(anomalies[:5]),
        increases=tuple(
            sorted(
                (item for item in changes if item.absolute_change > ZERO),
                key=lambda item: -item.absolute_change,
            )[:3]
        ),
        decreases=tuple(
            sorted(
                (item for item in changes if item.absolute_change < ZERO),
                key=lambda item: item.absolute_change,
            )[:3]
        ),
    )


def excluded_transfer_count(
    session: Session,
    selected_ids: tuple[int, ...],
    period_start: date,
    period_end: date,
) -> int:
    confirmed_ids = confirmed_transfer_transaction_subquery()
    return int(
        session.scalar(
            select(func.count())
            .select_from(Transaction)
            .where(
                Transaction.bank_account_id.in_(selected_ids),
                Transaction.date_issue.between(period_start, month_end(period_end)),
                Transaction.id.in_(select(confirmed_ids.c.transaction_id)),
            )
        )
        or 0
    )
