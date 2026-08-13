from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import request_session
from app.db.models import User
from app.schemas.analytics import (
    AnalyticsFilterQuery,
    CategoryComparisonsResponse,
    CategoryTotalResponse,
    CategoryTotalsResponse,
    ComparisonPeriodResponse,
    ComparisonQuery,
    MonthlyQuery,
    MonthlyTotalResponse,
    MonthlyTotalsResponse,
)
from app.services.analytics import category_comparisons, category_totals, monthly_totals
from app.services.transactions import TransactionFilters

router = APIRouter(prefix="/accounts/{account_id}/analytics", tags=["analytics"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DatabaseSession = Annotated[Session, Depends(request_session)]


def _filters(query: AnalyticsFilterQuery) -> TransactionFilters:
    return TransactionFilters(
        date_start=query.date_start,
        date_end=query.date_end,
        amount_min=query.amount_min,
        amount_max=query.amount_max,
        category_ids=tuple(query.category_ids),
        transaction_type=query.transaction_type,
    )


@router.get("/categories", response_model=CategoryTotalsResponse)
def analytics_categories(
    account_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
    query: Annotated[AnalyticsFilterQuery, Query()],
) -> CategoryTotalsResponse:
    totals = category_totals(session, current_user, account_id, _filters(query))
    return CategoryTotalsResponse(
        series=[
            CategoryTotalResponse(
                category=total.category,
                income=total.income,
                expense=total.expense,
            )
            for total in totals
        ]
    )


@router.get("/comparisons", response_model=CategoryComparisonsResponse)
def analytics_comparisons(
    account_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
    query: Annotated[ComparisonQuery, Query()],
) -> CategoryComparisonsResponse:
    periods = (query.periods[0], query.periods[1], query.periods[2])
    comparisons = category_comparisons(
        session,
        current_user,
        account_id,
        _filters(query),
        periods,
    )
    return CategoryComparisonsResponse(
        comparisons=[
            ComparisonPeriodResponse(
                period=comparison.period,
                label=comparison.label,
                series=[
                    CategoryTotalResponse(
                        category=total.category,
                        income=total.income,
                        expense=total.expense,
                    )
                    for total in comparison.totals
                ],
            )
            for comparison in comparisons
        ]
    )


@router.get("/monthly", response_model=MonthlyTotalsResponse)
def analytics_monthly(
    account_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
    query: Annotated[MonthlyQuery, Query()],
) -> MonthlyTotalsResponse:
    totals = monthly_totals(
        session,
        current_user,
        account_id,
        _filters(query),
        query.months,
    )
    return MonthlyTotalsResponse(
        series=[
            MonthlyTotalResponse(
                period=total.period,
                label=total.label,
                income=total.income,
                expense=total.expense,
            )
            for total in totals
        ]
    )
