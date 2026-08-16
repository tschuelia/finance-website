import calendar
import statistics
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select, union_all
from sqlalchemy.orm import Session

from app.db.models import (
    BankAccount,
    BankDepot,
    Category,
    Contract,
    DepotAsset,
    DepotBalanceSnapshot,
    InternalTransferReview,
    Transaction,
    User,
)
from app.errors import AuthorizationError, ResourceNotFoundError
from app.services.transfers import TransferReviewStatus

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
UNCATEGORIZED = "Ohne Kategorie"


@dataclass(frozen=True, slots=True)
class DashboardPeriod:
    start_month: str
    end_month: str
    label: str
    month_count: int
    is_partial: bool


@dataclass(frozen=True, slots=True)
class ComparedMetric:
    value: Decimal
    previous_value: Decimal
    absolute_change: Decimal
    percentage_change: Decimal | None


@dataclass(frozen=True, slots=True)
class CashFlowSummary:
    income: ComparedMetric
    expense: ComparedMetric
    net: ComparedMetric
    savings_rate: ComparedMetric | None


@dataclass(frozen=True, slots=True)
class MonthlyCashFlow:
    period: str
    label: str
    income: Decimal
    expense: Decimal
    net: Decimal


@dataclass(frozen=True, slots=True)
class AccountCashFlow:
    account_id: int
    account_name: str
    owner_name: str
    income: Decimal
    expense: Decimal
    net: Decimal


@dataclass(frozen=True, slots=True)
class CategoryCashFlow:
    category_id: int | None
    category: str
    expense: Decimal
    previous_expense: Decimal
    share: Decimal
    previous_share: Decimal


@dataclass(frozen=True, slots=True)
class CategoryMonth:
    period: str
    category_id: int | None
    category: str
    expense: Decimal


@dataclass(frozen=True, slots=True)
class ContractExpense:
    contract_id: int
    contract_name: str
    owner_name: str
    is_active: bool
    expense: Decimal
    monthly_average: Decimal
    share: Decimal


@dataclass(frozen=True, slots=True)
class ContractMonth:
    period: str
    contract_id: int
    expense: Decimal


@dataclass(frozen=True, slots=True)
class SpendingAnomaly:
    period: str
    category_id: int | None
    category: str
    expense: Decimal
    baseline_median: Decimal
    absolute_change: Decimal
    percentage_change: Decimal | None


@dataclass(frozen=True, slots=True)
class CategoryChange:
    category_id: int | None
    category: str
    monthly_average: Decimal
    previous_monthly_average: Decimal
    absolute_change: Decimal
    percentage_change: Decimal | None


@dataclass(frozen=True, slots=True)
class CashFlowDashboard:
    period: DashboardPeriod
    comparison_period: DashboardPeriod
    data_through: date | None
    account_ids: tuple[int, ...]
    excluded_transfer_count: int
    summary: CashFlowSummary
    monthly: tuple[MonthlyCashFlow, ...]
    accounts: tuple[AccountCashFlow, ...]
    categories: tuple[CategoryCashFlow, ...]
    category_monthly: tuple[CategoryMonth, ...]
    contracts: tuple[ContractExpense, ...]
    contract_monthly: tuple[ContractMonth, ...]
    contract_expense_share: Decimal
    anomalies: tuple[SpendingAnomaly, ...]
    increases: tuple[CategoryChange, ...]
    decreases: tuple[CategoryChange, ...]


@dataclass(frozen=True, slots=True)
class WealthPoint:
    period: str
    label: str
    total: Decimal | None
    bank_balance: Decimal
    depot_balance: Decimal | None
    estimated: bool
    coverage: Decimal


@dataclass(frozen=True, slots=True)
class WealthSource:
    source_type: str
    source_id: int
    name: str
    owner_name: str
    balance: Decimal
    last_update: date


@dataclass(frozen=True, slots=True)
class WealthDashboard:
    period: DashboardPeriod
    current_total: Decimal
    liquid_total: Decimal
    invested_total: Decimal
    period_start_total: Decimal | None
    period_end_total: Decimal | None
    absolute_change: Decimal | None
    percentage_change: Decimal | None
    monthly: tuple[WealthPoint, ...]
    sources: tuple[WealthSource, ...]


def _decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _month_start(value: str) -> date:
    year_text, month_text = value.split("-", maxsplit=1)
    return date(int(year_text), int(month_text), 1)


def _month_end(value: date) -> date:
    return date(value.year, value.month, calendar.monthrange(value.year, value.month)[1])


def _shift_month(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    return date(month_index // 12, month_index % 12 + 1, 1)


def _month_count(start: date, end: date) -> int:
    return (end.year - start.year) * 12 + end.month - start.month + 1


def _period(start: date, end: date, *, today: date) -> DashboardPeriod:
    count = _month_count(start, end)
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


def _resolved_period(
    start_month: str | None,
    end_month: str | None,
    latest_data: date | None,
    *,
    today: date,
) -> tuple[DashboardPeriod, DashboardPeriod, date, date]:
    if start_month is not None and end_month is not None:
        start = _month_start(start_month)
        end = _month_start(end_month)
    else:
        previous_month = _shift_month(today.replace(day=1), -1)
        latest_month = (latest_data or previous_month).replace(day=1)
        end = min(latest_month, previous_month) if latest_data is not None else previous_month
        start = _shift_month(end, -11)
    count = _month_count(start, end)
    comparison_end = _shift_month(start, -1)
    comparison_start = _shift_month(comparison_end, -(count - 1))
    return (
        _period(start, end, today=today),
        _period(comparison_start, comparison_end, today=today),
        start,
        end,
    )


def _visible_accounts(
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


def _visible_depots(
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


def _compared(value: Decimal, previous: Decimal) -> ComparedMetric:
    change = value - previous
    percentage = None if previous == ZERO else change / abs(previous)
    return ComparedMetric(
        value=value,
        previous_value=previous,
        absolute_change=change,
        percentage_change=percentage,
    )


def _confirmed_transfer_subquery():
    return union_all(
        select(InternalTransferReview.outgoing_transaction_id).where(
            InternalTransferReview.status == TransferReviewStatus.CONFIRMED.value
        ),
        select(InternalTransferReview.incoming_transaction_id).where(
            InternalTransferReview.status == TransferReviewStatus.CONFIRMED.value
        ),
    ).subquery()


def get_cash_flow_dashboard(
    session: Session,
    current_user: User,
    account_ids: tuple[int, ...] = (),
    *,
    start_month: str | None = None,
    end_month: str | None = None,
    today: date | None = None,
) -> CashFlowDashboard:
    current_day = today or date.today()
    accounts = _visible_accounts(session, current_user, account_ids)
    selected_ids = tuple(account.id for account in accounts)
    latest_data = (
        session.scalar(
            select(func.max(Transaction.date_issue)).where(
                Transaction.bank_account_id.in_(selected_ids)
            )
        )
        if selected_ids
        else None
    )
    period, comparison_period, period_start, period_end = _resolved_period(
        start_month,
        end_month,
        latest_data,
        today=current_day,
    )
    comparison_start = _month_start(comparison_period.start_month)
    scan_start = min(comparison_start, _shift_month(period_end, -6))
    scan_end = _month_end(period_end)
    confirmed_ids = _confirmed_transfer_subquery()
    transaction_clauses = (
        Transaction.bank_account_id.in_(selected_ids),
        Transaction.date_issue.between(scan_start, scan_end),
        Transaction.id.not_in(select(confirmed_ids.c.outgoing_transaction_id)),
    )
    period_column = func.strftime("%Y-%m", Transaction.date_issue)

    monthly_values: dict[str, tuple[Decimal, Decimal]] = {}
    for month, income, expense in session.execute(
        select(
            period_column,
            func.sum(case((Transaction.amount > ZERO, Transaction.amount), else_=ZERO)),
            func.sum(case((Transaction.amount < ZERO, -Transaction.amount), else_=ZERO)),
        )
        .where(*transaction_clauses)
        .group_by(period_column)
    ):
        monthly_values[str(month)] = (_decimal(income), _decimal(expense))

    def month_totals(start: date, count: int) -> tuple[Decimal, Decimal]:
        values = [
            monthly_values.get(
                _shift_month(start, offset).strftime("%Y-%m"),
                (ZERO, ZERO),
            )
            for offset in range(count)
        ]
        return (
            sum((value[0] for value in values), start=ZERO),
            sum((value[1] for value in values), start=ZERO),
        )

    income, expense = month_totals(period_start, period.month_count)
    previous_income, previous_expense = month_totals(
        comparison_start,
        comparison_period.month_count,
    )
    net = income - expense
    previous_net = previous_income - previous_expense
    savings_rate = None
    if income > ZERO:
        current_rate = net / income
        previous_rate = previous_net / previous_income if previous_income > ZERO else ZERO
        savings_rate = _compared(current_rate, previous_rate)

    monthly = tuple(
        MonthlyCashFlow(
            period=month.strftime("%Y-%m"),
            label=f"{GERMAN_MONTHS[month.month]} {month.year}",
            income=values[0],
            expense=values[1],
            net=values[0] - values[1],
        )
        for offset in range(period.month_count)
        for month in (_shift_month(period_start, offset),)
        for values in (monthly_values.get(month.strftime("%Y-%m"), (ZERO, ZERO)),)
    )

    account_rows = session.execute(
        select(
            BankAccount.id,
            BankAccount.name,
            User.username,
            func.sum(case((Transaction.amount > ZERO, Transaction.amount), else_=ZERO)),
            func.sum(case((Transaction.amount < ZERO, -Transaction.amount), else_=ZERO)),
        )
        .join(Transaction, Transaction.bank_account_id == BankAccount.id)
        .join(User, BankAccount.owner_id == User.id)
        .where(
            Transaction.bank_account_id.in_(selected_ids),
            Transaction.date_issue.between(period_start, _month_end(period_end)),
            Transaction.id.not_in(select(confirmed_ids.c.outgoing_transaction_id)),
        )
        .group_by(BankAccount.id, BankAccount.name, User.username)
    )
    account_values = {
        int(account_id): (str(name), str(owner), _decimal(row_income), _decimal(row_expense))
        for account_id, name, owner, row_income, row_expense in account_rows
    }
    owners = {user.id: user.username for user in session.scalars(select(User))}
    account_breakdown = tuple(
        AccountCashFlow(
            account_id=account.id,
            account_name=account.name,
            owner_name=owners.get(account.owner_id, ""),
            income=account_values.get(account.id, ("", "", ZERO, ZERO))[2],
            expense=account_values.get(account.id, ("", "", ZERO, ZERO))[3],
            net=(
                account_values.get(account.id, ("", "", ZERO, ZERO))[2]
                - account_values.get(account.id, ("", "", ZERO, ZERO))[3]
            ),
        )
        for account in accounts
    )

    category_name = func.coalesce(Category.name, UNCATEGORIZED)
    category_rows = session.execute(
        select(
            Transaction.category_id,
            category_name,
            period_column,
            func.sum(case((Transaction.amount < ZERO, -Transaction.amount), else_=ZERO)),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(*transaction_clauses)
        .group_by(Transaction.category_id, category_name, period_column)
    )
    category_month_values: dict[tuple[int | None, str, str], Decimal] = {}
    category_names: dict[int | None, str] = {}
    for category_id, name, month, amount in category_rows:
        key = int(category_id) if category_id is not None else None
        category_names[key] = str(name)
        category_month_values[(key, str(name), str(month))] = _decimal(amount)

    def category_total(category_id: int | None, name: str, start: date, count: int) -> Decimal:
        return sum(
            (
                category_month_values.get(
                    (category_id, name, _shift_month(start, offset).strftime("%Y-%m")),
                    ZERO,
                )
                for offset in range(count)
            ),
            start=ZERO,
        )

    category_totals = []
    for category_id, name in category_names.items():
        current_amount = category_total(category_id, name, period_start, period.month_count)
        previous_amount = category_total(
            category_id,
            name,
            comparison_start,
            comparison_period.month_count,
        )
        if current_amount != ZERO or previous_amount != ZERO:
            category_totals.append(
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
    categories = tuple(
        sorted(category_totals, key=lambda item: (-item.expense, item.category.casefold()))
    )
    category_monthly = tuple(
        CategoryMonth(
            period=month.strftime("%Y-%m"),
            category_id=category.category_id,
            category=category.category,
            expense=category_month_values.get(
                (category.category_id, category.category, month.strftime("%Y-%m")),
                ZERO,
            ),
        )
        for offset in range(period.month_count)
        for month in (_shift_month(period_start, offset),)
        for category in categories
        if category_month_values.get(
            (category.category_id, category.category, month.strftime("%Y-%m")),
            ZERO,
        )
        > ZERO
    )

    contract_rows = session.execute(
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
            Transaction.date_issue.between(period_start, _month_end(period_end)),
            Transaction.amount < ZERO,
            Transaction.id.not_in(select(confirmed_ids.c.outgoing_transaction_id)),
        )
        .group_by(
            Contract.id,
            Contract.name,
            User.username,
            Contract.is_active,
            period_column,
        )
    )
    contract_metadata: dict[int, tuple[str, str, bool]] = {}
    contract_totals: dict[int, Decimal] = {}
    contract_month_values: dict[tuple[str, int], Decimal] = {}
    for contract_id, name, owner, is_active, month, amount in contract_rows:
        identifier = int(contract_id)
        value = _decimal(amount)
        contract_metadata[identifier] = (str(name), str(owner), bool(is_active))
        contract_totals[identifier] = contract_totals.get(identifier, ZERO) + value
        contract_month_values[(str(month), identifier)] = value

    contracts = tuple(
        sorted(
            (
                ContractExpense(
                    contract_id=contract_id,
                    contract_name=contract_metadata[contract_id][0],
                    owner_name=contract_metadata[contract_id][1],
                    is_active=contract_metadata[contract_id][2],
                    expense=amount,
                    monthly_average=amount / Decimal(period.month_count),
                    share=amount / expense if expense > ZERO else ZERO,
                )
                for contract_id, amount in contract_totals.items()
            ),
            key=lambda item: (-item.expense, item.contract_name.casefold(), item.contract_id),
        )
    )
    contract_monthly = tuple(
        ContractMonth(period=month, contract_id=contract_id, expense=amount)
        for (month, contract_id), amount in sorted(contract_month_values.items())
    )
    contract_total = sum((item.expense for item in contracts), start=ZERO)

    target = min(period_end, _shift_month(current_day.replace(day=1), -1))
    oldest_transaction = session.scalar(
        select(func.min(Transaction.date_issue)).where(
            Transaction.bank_account_id.in_(selected_ids)
        )
    )
    history_months = max(
        0,
        min(
            6,
            _month_count(
                oldest_transaction.replace(day=1) if oldest_transaction is not None else target,
                _shift_month(target, -1),
            ),
        ),
    )
    anomalies: list[SpendingAnomaly] = []
    if history_months >= 3:
        for category_id, name in category_names.items():
            target_amount = category_month_values.get(
                (category_id, name, target.strftime("%Y-%m")),
                ZERO,
            )
            baseline_values = [
                category_month_values.get(
                    (category_id, name, _shift_month(target, -offset).strftime("%Y-%m")),
                    ZERO,
                )
                for offset in range(1, 7)
            ]
            baseline = _decimal(statistics.median(baseline_values))
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
        for item in categories
    ]
    increases = tuple(
        sorted(
            (item for item in changes if item.absolute_change > ZERO),
            key=lambda item: -item.absolute_change,
        )[:3]
    )
    decreases = tuple(
        sorted(
            (item for item in changes if item.absolute_change < ZERO),
            key=lambda item: item.absolute_change,
        )[:3]
    )
    excluded_transfer_count = (
        session.scalar(
            select(func.count())
            .select_from(Transaction)
            .where(
                Transaction.bank_account_id.in_(selected_ids),
                Transaction.date_issue.between(period_start, _month_end(period_end)),
                Transaction.id.in_(select(confirmed_ids.c.outgoing_transaction_id)),
            )
        )
        or 0
    )

    return CashFlowDashboard(
        period=period,
        comparison_period=comparison_period,
        data_through=latest_data,
        account_ids=selected_ids,
        excluded_transfer_count=int(excluded_transfer_count),
        summary=CashFlowSummary(
            income=_compared(income, previous_income),
            expense=_compared(expense, previous_expense),
            net=_compared(net, previous_net),
            savings_rate=savings_rate,
        ),
        monthly=monthly,
        accounts=account_breakdown,
        categories=categories,
        category_monthly=category_monthly,
        contracts=contracts,
        contract_monthly=contract_monthly,
        contract_expense_share=contract_total / expense if expense > ZERO else ZERO,
        anomalies=tuple(anomalies[:5]),
        increases=increases,
        decreases=decreases,
    )


def get_wealth_dashboard(
    session: Session,
    current_user: User,
    account_ids: tuple[int, ...],
    depot_ids: tuple[int, ...],
    *,
    start_month: str | None = None,
    end_month: str | None = None,
    today: date | None = None,
) -> WealthDashboard:
    current_day = today or date.today()
    accounts = _visible_accounts(session, current_user, account_ids) if account_ids else ()
    depots = _visible_depots(session, current_user, depot_ids) if depot_ids else ()
    if not accounts and not depots:
        raise ValueError("at least one wealth source is required")
    latest_account = (
        session.scalar(
            select(func.max(Transaction.date_issue)).where(
                Transaction.bank_account_id.in_(tuple(account.id for account in accounts))
            )
        )
        if accounts
        else None
    )
    latest_depot = (
        session.scalar(
            select(func.max(DepotBalanceSnapshot.date)).where(
                DepotBalanceSnapshot.bank_depot_id.in_(tuple(depot.id for depot in depots))
            )
        )
        if depots
        else None
    )
    latest_data = max(
        (value for value in (latest_account, latest_depot) if value is not None),
        default=None,
    )
    period, _, period_start, period_end = _resolved_period(
        start_month,
        end_month,
        latest_data,
        today=current_day,
    )

    account_ids_resolved = tuple(account.id for account in accounts)
    account_month_changes: dict[tuple[int, str], Decimal] = {}
    if account_ids_resolved:
        for account_id, month, amount in session.execute(
            select(
                Transaction.bank_account_id,
                func.strftime("%Y-%m", Transaction.date_issue),
                func.sum(Transaction.amount),
            )
            .where(
                Transaction.bank_account_id.in_(account_ids_resolved),
                Transaction.date_issue <= _month_end(period_end),
            )
            .group_by(Transaction.bank_account_id, func.strftime("%Y-%m", Transaction.date_issue))
        ):
            if account_id is not None:
                account_month_changes[(int(account_id), str(month))] = _decimal(amount)

    account_balances = {account.id: account.current_amount for account in accounts}
    for account in accounts:
        for (account_id, month), amount in account_month_changes.items():
            if account_id == account.id and month < period_start.strftime("%Y-%m"):
                account_balances[account.id] += amount

    depot_snapshots: dict[int, list[tuple[date, Decimal, bool]]] = {
        depot.id: [] for depot in depots
    }
    if depot_snapshots:
        for depot_id, snapshot_date, balance, estimated in session.execute(
            select(
                DepotBalanceSnapshot.bank_depot_id,
                DepotBalanceSnapshot.date,
                DepotBalanceSnapshot.balance,
                DepotBalanceSnapshot.is_estimated,
            )
            .where(
                DepotBalanceSnapshot.bank_depot_id.in_(tuple(depot_snapshots)),
                DepotBalanceSnapshot.date <= _month_end(period_end),
            )
            .order_by(DepotBalanceSnapshot.bank_depot_id, DepotBalanceSnapshot.date)
        ):
            depot_snapshots[int(depot_id)].append(
                (snapshot_date, _decimal(balance), bool(estimated))
            )

    monthly: list[WealthPoint] = []
    source_count = len(accounts) + len(depots)
    for offset in range(period.month_count):
        month = _shift_month(period_start, offset)
        month_key = month.strftime("%Y-%m")
        for account in accounts:
            account_balances[account.id] += account_month_changes.get((account.id, month_key), ZERO)
        bank_total = sum(account_balances.values(), start=ZERO)
        known_depot_values: list[Decimal] = []
        estimated = False
        for depot in depots:
            known = [
                snapshot
                for snapshot in depot_snapshots[depot.id]
                if snapshot[0] <= _month_end(month)
            ]
            if known:
                snapshot_date, balance, snapshot_estimated = known[-1]
                known_depot_values.append(balance)
                estimated = estimated or snapshot_estimated or snapshot_date < _month_end(month)
        depot_total = (
            sum(known_depot_values, start=ZERO) if len(known_depot_values) == len(depots) else None
        )
        known_count = len(accounts) + len(known_depot_values)
        total = None if depot_total is None else bank_total + depot_total
        monthly.append(
            WealthPoint(
                period=month_key,
                label=f"{GERMAN_MONTHS[month.month]} {month.year}",
                total=total,
                bank_balance=bank_total,
                depot_balance=depot_total,
                estimated=estimated,
                coverage=Decimal(known_count) / Decimal(source_count),
            )
        )

    owners = {user.id: user.username for user in session.scalars(select(User))}
    account_current_totals = {
        int(account_id): _decimal(starting) + _decimal(total)
        for account_id, starting, total in session.execute(
            select(BankAccount.id, BankAccount.current_amount, func.sum(Transaction.amount))
            .outerjoin(Transaction, Transaction.bank_account_id == BankAccount.id)
            .where(BankAccount.id.in_(account_ids_resolved))
            .group_by(BankAccount.id)
        )
    }
    account_dates = {
        int(account_id): (latest or current_day)
        for account_id, latest in session.execute(
            select(BankAccount.id, func.max(Transaction.date_issue))
            .outerjoin(Transaction, Transaction.bank_account_id == BankAccount.id)
            .where(BankAccount.id.in_(account_ids_resolved))
            .group_by(BankAccount.id)
        )
    }
    depot_current_totals = {
        int(depot_id): (_decimal(balance), last_update or current_day)
        for depot_id, balance, last_update in session.execute(
            select(
                BankDepot.id,
                func.sum(DepotAsset.current_balance),
                func.max(DepotAsset.last_update),
            )
            .outerjoin(DepotAsset, DepotAsset.bank_depot_id == BankDepot.id)
            .where(BankDepot.id.in_(tuple(depot.id for depot in depots)))
            .group_by(BankDepot.id)
        )
    }
    sources = tuple(
        [
            WealthSource(
                source_type="account",
                source_id=account.id,
                name=account.name,
                owner_name=owners.get(account.owner_id, ""),
                balance=account_current_totals.get(account.id, account.current_amount),
                last_update=account_dates.get(account.id, current_day),
            )
            for account in accounts
        ]
        + [
            WealthSource(
                source_type="depot",
                source_id=depot.id,
                name=depot.name,
                owner_name=owners.get(depot.owner_id, ""),
                balance=depot_current_totals.get(depot.id, (ZERO, current_day))[0],
                last_update=depot_current_totals.get(depot.id, (ZERO, current_day))[1],
            )
            for depot in depots
        ]
    )
    liquid_total = sum(
        (source.balance for source in sources if source.source_type == "account"),
        start=ZERO,
    )
    invested_total = sum(
        (source.balance for source in sources if source.source_type == "depot"),
        start=ZERO,
    )
    known_points = [point for point in monthly if point.total is not None]
    period_start_total = known_points[0].total if known_points else None
    period_end_total = known_points[-1].total if known_points else None
    absolute_change = (
        period_end_total - period_start_total
        if period_start_total is not None and period_end_total is not None
        else None
    )
    percentage_change = (
        None
        if absolute_change is None or period_start_total in (None, ZERO)
        else absolute_change / abs(period_start_total)
    )
    return WealthDashboard(
        period=period,
        current_total=liquid_total + invested_total,
        liquid_total=liquid_total,
        invested_total=invested_total,
        period_start_total=period_start_total,
        period_end_total=period_end_total,
        absolute_change=absolute_change,
        percentage_change=percentage_change,
        monthly=tuple(monthly),
        sources=tuple(
            sorted(sources, key=lambda source: (-source.balance, source.name.casefold()))
        ),
    )
