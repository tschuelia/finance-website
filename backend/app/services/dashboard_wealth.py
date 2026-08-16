from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    BankAccount,
    BankDepot,
    DepotAsset,
    DepotBalanceSnapshot,
    Transaction,
    User,
)
from app.services.dashboard_common import (
    GERMAN_MONTHS,
    ZERO,
    decimal_value,
    month_end,
    resolve_period,
    shift_month,
    visible_accounts,
    visible_depots,
)
from app.services.dashboard_models import (
    WealthDashboard,
    WealthPoint,
    WealthSource,
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
    accounts = visible_accounts(session, current_user, account_ids) if account_ids else ()
    depots = visible_depots(session, current_user, depot_ids) if depot_ids else ()
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
    period, _, period_start, period_end = resolve_period(
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
                Transaction.date_issue <= month_end(period_end),
            )
            .group_by(Transaction.bank_account_id, func.strftime("%Y-%m", Transaction.date_issue))
        ):
            if account_id is not None:
                account_month_changes[(int(account_id), str(month))] = decimal_value(amount)

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
                DepotBalanceSnapshot.date <= month_end(period_end),
            )
            .order_by(DepotBalanceSnapshot.bank_depot_id, DepotBalanceSnapshot.date)
        ):
            depot_snapshots[int(depot_id)].append(
                (snapshot_date, decimal_value(balance), bool(estimated))
            )

    monthly: list[WealthPoint] = []
    source_count = len(accounts) + len(depots)
    for offset in range(period.month_count):
        month = shift_month(period_start, offset)
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
                if snapshot[0] <= month_end(month)
            ]
            if known:
                snapshot_date, balance, snapshot_estimated = known[-1]
                known_depot_values.append(balance)
                estimated = estimated or snapshot_estimated or snapshot_date < month_end(month)
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
        int(account_id): decimal_value(starting) + decimal_value(total)
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
        int(depot_id): (decimal_value(balance), last_update or current_day)
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
