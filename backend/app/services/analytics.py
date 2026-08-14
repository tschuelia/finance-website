import calendar
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db.models import Category, Transaction, User
from app.services.access import get_visible_bank_account
from app.services.transactions import TransactionFilters, transaction_filter_clauses

ZERO = Decimal("0")
UNCATEGORIZED = "ohne Kategorie"
GERMAN_MONTHS = (
    "",
    "Jan",
    "Feb",
    "Mär",
    "Apr",
    "Mai",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Dez",
)


@dataclass(frozen=True, slots=True)
class CategoryTotal:
    category: str
    income: Decimal
    expense: Decimal


@dataclass(frozen=True, slots=True)
class ComparisonPeriod:
    period: str
    label: str
    totals: tuple[CategoryTotal, ...]


@dataclass(frozen=True, slots=True)
class MonthlyTotal:
    period: str
    label: str
    income: Decimal
    expense: Decimal


def _decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _sorted_category_totals(
    totals: dict[str, tuple[Decimal, Decimal]],
) -> tuple[CategoryTotal, ...]:
    return tuple(
        CategoryTotal(category=name, income=income, expense=expense)
        for name, (income, expense) in sorted(
            totals.items(),
            key=lambda item: (-item[1][1], -item[1][0], item[0].casefold()),
        )
    )


def category_totals(
    session: Session,
    current_user: User,
    account_id: int,
    filters: TransactionFilters,
) -> tuple[CategoryTotal, ...]:
    account = get_visible_bank_account(session, current_user, account_id)
    clauses = transaction_filter_clauses(session, account.id, filters, date.today())
    category_name = func.coalesce(Category.name, UNCATEGORIZED)
    rows = session.execute(
        select(
            category_name,
            func.sum(case((Transaction.amount >= ZERO, Transaction.amount), else_=ZERO)),
            func.sum(case((Transaction.amount < ZERO, -Transaction.amount), else_=ZERO)),
        )
        .select_from(Transaction)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(*clauses)
        .group_by(category_name)
    )
    return _sorted_category_totals(
        {str(category): (_decimal(income), _decimal(expense)) for category, income, expense in rows}
    )


def _period_dates(period: str) -> tuple[date, date, str]:
    try:
        if len(period) == 4:
            year = int(period)
            return date(year, 1, 1), date(year, 12, 31), str(year)
        year_text, month_text = period.split("-", maxsplit=1)
        year = int(year_text)
        month = int(month_text)
        last_day = calendar.monthrange(year, month)[1]
        return (
            date(year, month, 1),
            date(year, month, last_day),
            f"{GERMAN_MONTHS[month]} {year}",
        )
    except ValueError, IndexError:
        raise ValueError(f"Ungültiger Vergleichszeitraum: {period}") from None


def category_comparisons(
    session: Session,
    current_user: User,
    account_id: int,
    filters: TransactionFilters,
    periods: tuple[str, str, str],
) -> tuple[ComparisonPeriod, ...]:
    period_ranges: list[tuple[str, str, date, date]] = []
    for period in periods:
        date_start, date_end, label = _period_dates(period)
        if filters.date_start is not None:
            date_start = max(date_start, filters.date_start)
        if filters.date_end is not None:
            date_end = min(date_end, filters.date_end)
        period_ranges.append((period, label, date_start, date_end))

    account = get_visible_bank_account(session, current_user, account_id)
    scan_filters = TransactionFilters(
        search_term=filters.search_term,
        date_start=min(item[2] for item in period_ranges),
        date_end=max(item[3] for item in period_ranges),
        amount_min=filters.amount_min,
        amount_max=filters.amount_max,
        category_ids=filters.category_ids,
        transaction_type=filters.transaction_type,
    )
    clauses = transaction_filter_clauses(session, account.id, scan_filters, date.today())
    category_name = func.coalesce(Category.name, UNCATEGORIZED)
    aggregates: list[Any] = []
    for _, _, date_start, date_end in period_ranges:
        in_period = Transaction.date_issue.between(date_start, date_end)
        aggregates.extend(
            (
                func.sum(
                    case(
                        (in_period & (Transaction.amount >= ZERO), Transaction.amount),
                        else_=ZERO,
                    )
                ),
                func.sum(
                    case(
                        (in_period & (Transaction.amount < ZERO), -Transaction.amount),
                        else_=ZERO,
                    )
                ),
            )
        )
    totals_by_period: list[dict[str, tuple[Decimal, Decimal]]] = [{} for _ in period_ranges]
    for row in session.execute(
        select(category_name, *aggregates)
        .select_from(Transaction)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(*clauses)
        .group_by(category_name)
    ):
        category = str(row[0])
        for index in range(len(period_ranges)):
            income = _decimal(row[1 + index * 2])
            expense = _decimal(row[2 + index * 2])
            if income != ZERO or expense != ZERO:
                totals_by_period[index][category] = (income, expense)

    return tuple(
        ComparisonPeriod(
            period=period,
            label=label,
            totals=_sorted_category_totals(totals_by_period[index]),
        )
        for index, (period, label, _, _) in enumerate(period_ranges)
    )


def _shift_month(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    return date(month_index // 12, month_index % 12 + 1, 1)


def monthly_totals(
    session: Session,
    current_user: User,
    account_id: int,
    filters: TransactionFilters,
    months: int,
    *,
    today: date | None = None,
) -> tuple[MonthlyTotal, ...]:
    current_month = (today or date.today()).replace(day=1)
    first_month = _shift_month(current_month, -(months - 1))
    filter_start = max(
        (value for value in (first_month, filters.date_start) if value is not None),
    )
    bounded_filters = TransactionFilters(
        search_term=filters.search_term,
        date_start=filter_start,
        date_end=filters.date_end,
        amount_min=filters.amount_min,
        amount_max=filters.amount_max,
        category_ids=filters.category_ids,
        transaction_type=filters.transaction_type,
    )
    account = get_visible_bank_account(session, current_user, account_id)
    clauses = transaction_filter_clauses(
        session,
        account.id,
        bounded_filters,
        today or date.today(),
    )
    period_column = func.strftime("%Y-%m", Transaction.date_issue)
    totals = {
        str(period): (_decimal(income), _decimal(expense))
        for period, income, expense in session.execute(
            select(
                period_column,
                func.sum(case((Transaction.amount >= ZERO, Transaction.amount), else_=ZERO)),
                func.sum(case((Transaction.amount < ZERO, -Transaction.amount), else_=ZERO)),
            )
            .where(*clauses)
            .group_by(period_column)
        )
    }

    result: list[MonthlyTotal] = []
    for offset in range(months):
        month = _shift_month(first_month, offset)
        income, expense = totals.get(month.strftime("%Y-%m"), (ZERO, ZERO))
        result.append(
            MonthlyTotal(
                period=month.strftime("%Y-%m"),
                label=f"{GERMAN_MONTHS[month.month]} {month.year}",
                income=income,
                expense=expense,
            )
        )
    return tuple(result)
