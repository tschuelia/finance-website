import calendar
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import BankAccount, BankDepot, User
from app.errors import AuthorizationError, ResourceNotFoundError
from app.services.dashboard_models import ComparedMetric, DashboardPeriod

ZERO = Decimal("0")
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


def decimal_value(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def month_start(value: str) -> date:
    year_text, month_text = value.split("-", maxsplit=1)
    return date(int(year_text), int(month_text), 1)


def month_end(value: date) -> date:
    return date(value.year, value.month, calendar.monthrange(value.year, value.month)[1])


def shift_month(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    return date(month_index // 12, month_index % 12 + 1, 1)


def month_count(start: date, end: date) -> int:
    return (end.year - start.year) * 12 + end.month - start.month + 1


def dashboard_period(start: date, end: date, *, today: date) -> DashboardPeriod:
    count = month_count(start, end)
    return DashboardPeriod(
        start_month=start.strftime("%Y-%m"),
        end_month=end.strftime("%Y-%m"),
        label=(
            f"{GERMAN_MONTHS[start.month]} {start.year}"
            if count == 1
            else (
                f"{GERMAN_MONTHS[start.month]} {start.year} – {GERMAN_MONTHS[end.month]} {end.year}"
            )
        ),
        month_count=count,
        is_partial=end.year == today.year and end.month == today.month,
    )


def resolve_period(
    start_month_value: str | None,
    end_month_value: str | None,
    latest_data: date | None,
    *,
    today: date,
) -> tuple[DashboardPeriod, DashboardPeriod, date, date]:
    if start_month_value is not None and end_month_value is not None:
        start = month_start(start_month_value)
        end = month_start(end_month_value)
    else:
        previous_month = shift_month(today.replace(day=1), -1)
        latest_month = (latest_data or previous_month).replace(day=1)
        end = min(latest_month, previous_month) if latest_data is not None else previous_month
        start = shift_month(end, -11)
    count = month_count(start, end)
    comparison_end = shift_month(start, -1)
    comparison_start = shift_month(comparison_end, -(count - 1))
    return (
        dashboard_period(start, end, today=today),
        dashboard_period(comparison_start, comparison_end, today=today),
        start,
        end,
    )


def visible_accounts(
    session: Session,
    current_user: User,
    account_ids: tuple[int, ...],
) -> tuple[BankAccount, ...]:
    statement = select(BankAccount).order_by(BankAccount.owner_id, BankAccount.id)
    if account_ids:
        statement = statement.where(BankAccount.id.in_(account_ids))
    if not current_user.is_superuser:
        statement = statement.where(BankAccount.owner_id == current_user.id)
    accounts = tuple(session.scalars(statement))
    if account_ids and {account.id for account in accounts} != set(account_ids):
        existing = set(
            session.scalars(select(BankAccount.id).where(BankAccount.id.in_(account_ids)))
        )
        if existing != set(account_ids):
            raise ResourceNotFoundError()
        raise AuthorizationError()
    return accounts


def visible_depots(
    session: Session,
    current_user: User,
    depot_ids: tuple[int, ...],
) -> tuple[BankDepot, ...]:
    statement = select(BankDepot).order_by(BankDepot.owner_id, BankDepot.id)
    if depot_ids:
        statement = statement.where(BankDepot.id.in_(depot_ids))
    if not current_user.is_superuser:
        statement = statement.where(BankDepot.owner_id == current_user.id)
    depots = tuple(session.scalars(statement))
    if depot_ids and {depot.id for depot in depots} != set(depot_ids):
        existing = set(session.scalars(select(BankDepot.id).where(BankDepot.id.in_(depot_ids))))
        if existing != set(depot_ids):
            raise ResourceNotFoundError()
        raise AuthorizationError()
    return depots


def compared_metric(value: Decimal, previous: Decimal) -> ComparedMetric:
    change = value - previous
    percentage = None if previous == ZERO else change / abs(previous)
    return ComparedMetric(
        value=value,
        previous_value=previous,
        absolute_change=change,
        percentage_change=percentage,
    )
