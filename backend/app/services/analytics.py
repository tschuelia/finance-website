import calendar
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Transaction, User
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


def _rows(
    session: Session,
    current_user: User,
    account_id: int,
    filters: TransactionFilters,
) -> tuple[Transaction, ...]:
    account = get_visible_bank_account(session, current_user, account_id)
    clauses = transaction_filter_clauses(session, account.id, filters, date.today())
    return tuple(
        session.scalars(
            select(Transaction).where(*clauses).order_by(Transaction.date_issue, Transaction.id)
        )
    )


def category_totals(
    session: Session,
    current_user: User,
    account_id: int,
    filters: TransactionFilters,
) -> tuple[CategoryTotal, ...]:
    totals: dict[str, tuple[Decimal, Decimal]] = {}
    for transaction in _rows(session, current_user, account_id, filters):
        category = transaction.category.name if transaction.category is not None else UNCATEGORIZED
        income, expense = totals.get(category, (ZERO, ZERO))
        if transaction.amount >= ZERO:
            income += transaction.amount
        else:
            expense += abs(transaction.amount)
        totals[category] = (income, expense)
    return tuple(
        CategoryTotal(category=name, income=income, expense=expense)
        for name, (income, expense) in sorted(
            totals.items(),
            key=lambda item: (-item[1][1], -item[1][0], item[0].casefold()),
        )
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
    comparisons: list[ComparisonPeriod] = []
    for period in periods:
        date_start, date_end, label = _period_dates(period)
        if filters.date_start is not None:
            date_start = max(date_start, filters.date_start)
        if filters.date_end is not None:
            date_end = min(date_end, filters.date_end)
        period_filters = TransactionFilters(
            search_term=filters.search_term,
            date_start=date_start,
            date_end=date_end,
            amount_min=filters.amount_min,
            amount_max=filters.amount_max,
            category_ids=filters.category_ids,
            transaction_type=filters.transaction_type,
        )
        comparisons.append(
            ComparisonPeriod(
                period=period,
                label=label,
                totals=category_totals(session, current_user, account_id, period_filters),
            )
        )
    return tuple(comparisons)


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
    totals: dict[tuple[int, int], tuple[Decimal, Decimal]] = {}
    for transaction in _rows(session, current_user, account_id, bounded_filters):
        key = (transaction.date_issue.year, transaction.date_issue.month)
        income, expense = totals.get(key, (ZERO, ZERO))
        if transaction.amount >= ZERO:
            income += transaction.amount
        else:
            expense += abs(transaction.amount)
        totals[key] = (income, expense)

    result: list[MonthlyTotal] = []
    for offset in range(months):
        month = _shift_month(first_month, offset)
        income, expense = totals.get((month.year, month.month), (ZERO, ZERO))
        result.append(
            MonthlyTotal(
                period=month.strftime("%Y-%m"),
                label=f"{GERMAN_MONTHS[month.month]} {month.year}",
                income=income,
                expense=expense,
            )
        )
    return tuple(result)
