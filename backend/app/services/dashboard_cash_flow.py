from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db.models import Transaction, User
from app.services.dashboard_cash_flow_sections import (
    account_breakdown,
    category_breakdown,
    contract_breakdown,
    excluded_transfer_count,
    spending_insights,
)
from app.services.dashboard_common import (
    GERMAN_MONTHS,
    ZERO,
    compared_metric,
    decimal_value,
    month_end,
    month_start,
    resolve_period,
    shift_month,
    visible_accounts,
)
from app.services.dashboard_models import (
    CashFlowDashboard,
    CashFlowSummary,
    MonthlyCashFlow,
)
from app.services.transfers import confirmed_transfer_transaction_subquery


def _month_totals(
    monthly_values: dict[str, tuple[Decimal, Decimal]],
    start: date,
    count: int,
) -> tuple[Decimal, Decimal]:
    values = [
        monthly_values.get(shift_month(start, offset).strftime("%Y-%m"), (ZERO, ZERO))
        for offset in range(count)
    ]
    return (
        sum((value[0] for value in values), start=ZERO),
        sum((value[1] for value in values), start=ZERO),
    )


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
    accounts = visible_accounts(session, current_user, account_ids)
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
    period, comparison_period, period_start, period_end = resolve_period(
        start_month,
        end_month,
        latest_data,
        today=current_day,
    )
    comparison_start = month_start(comparison_period.start_month)
    scan_start = min(comparison_start, shift_month(period_end, -6))
    scan_end = month_end(period_end)
    confirmed_ids = confirmed_transfer_transaction_subquery()
    period_column = func.strftime("%Y-%m", Transaction.date_issue)
    monthly_values = {
        str(month): (decimal_value(income), decimal_value(expense))
        for month, income, expense in session.execute(
            select(
                period_column,
                func.sum(case((Transaction.amount > ZERO, Transaction.amount), else_=ZERO)),
                func.sum(case((Transaction.amount < ZERO, -Transaction.amount), else_=ZERO)),
            )
            .where(
                Transaction.bank_account_id.in_(selected_ids),
                Transaction.date_issue.between(scan_start, scan_end),
                Transaction.id.not_in(select(confirmed_ids.c.transaction_id)),
            )
            .group_by(period_column)
        )
    }

    income, expense = _month_totals(monthly_values, period_start, period.month_count)
    previous_income, previous_expense = _month_totals(
        monthly_values,
        comparison_start,
        comparison_period.month_count,
    )
    net = income - expense
    previous_net = previous_income - previous_expense
    savings_rate = None
    if income > ZERO:
        current_rate = net / income
        previous_rate = previous_net / previous_income if previous_income > ZERO else ZERO
        savings_rate = compared_metric(current_rate, previous_rate)
    monthly = tuple(
        MonthlyCashFlow(
            period=month.strftime("%Y-%m"),
            label=f"{GERMAN_MONTHS[month.month]} {month.year}",
            income=values[0],
            expense=values[1],
            net=values[0] - values[1],
        )
        for offset in range(period.month_count)
        for month in (shift_month(period_start, offset),)
        for values in (monthly_values.get(month.strftime("%Y-%m"), (ZERO, ZERO)),)
    )
    accounts_result = account_breakdown(
        session,
        accounts,
        selected_ids,
        period_start,
        period_end,
    )
    categories = category_breakdown(
        session,
        selected_ids,
        scan_start=scan_start,
        scan_end=scan_end,
        period=period,
        comparison_period=comparison_period,
        period_start=period_start,
        comparison_start=comparison_start,
        expense=expense,
        previous_expense=previous_expense,
    )
    contracts = contract_breakdown(
        session,
        selected_ids,
        period,
        period_start,
        period_end,
        expense,
    )
    insights = spending_insights(
        session,
        selected_ids,
        categories,
        period=period,
        comparison_period=comparison_period,
        period_end=period_end,
        current_day=current_day,
    )

    return CashFlowDashboard(
        period=period,
        comparison_period=comparison_period,
        data_through=latest_data,
        account_ids=selected_ids,
        excluded_transfer_count=excluded_transfer_count(
            session,
            selected_ids,
            period_start,
            period_end,
        ),
        summary=CashFlowSummary(
            income=compared_metric(income, previous_income),
            expense=compared_metric(expense, previous_expense),
            net=compared_metric(net, previous_net),
            savings_rate=savings_rate,
        ),
        monthly=monthly,
        accounts=accounts_result,
        categories=categories.items,
        category_monthly=categories.monthly,
        contracts=contracts.items,
        contract_monthly=contracts.monthly,
        contract_expense_share=contracts.total / expense if expense > ZERO else ZERO,
        anomalies=insights.anomalies,
        increases=insights.increases,
        decreases=insights.decreases,
    )
