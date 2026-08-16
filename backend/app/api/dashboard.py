from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import request_session
from app.db.models import User
from app.schemas.dashboard import (
    CashFlowDashboardResponse,
    CashFlowQuery,
    WealthDashboardResponse,
    WealthQuery,
)
from app.services.dashboard import get_cash_flow_dashboard, get_wealth_dashboard

router = APIRouter(prefix="/analytics", tags=["analytics"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DatabaseSession = Annotated[Session, Depends(request_session)]


@router.get("/cash-flow", response_model=CashFlowDashboardResponse)
def analytics_cash_flow(
    current_user: CurrentUser,
    session: DatabaseSession,
    query: Annotated[CashFlowQuery, Query()],
) -> CashFlowDashboardResponse:
    result = get_cash_flow_dashboard(
        session,
        current_user,
        tuple(dict.fromkeys(query.account_ids)),
        start_month=query.start_month,
        end_month=query.end_month,
    )
    return CashFlowDashboardResponse.model_validate(result)


@router.get("/wealth", response_model=WealthDashboardResponse)
def analytics_wealth(
    current_user: CurrentUser,
    session: DatabaseSession,
    query: Annotated[WealthQuery, Query()],
) -> WealthDashboardResponse:
    account_ids: list[int] = []
    depot_ids: list[int] = []
    for source in query.sources:
        kind, _, identifier = source.partition(":")
        if kind == "account":
            account_ids.append(int(identifier))
        else:
            depot_ids.append(int(identifier))
    result = get_wealth_dashboard(
        session,
        current_user,
        tuple(account_ids),
        tuple(depot_ids),
        start_month=query.start_month,
        end_month=query.end_month,
    )
    return WealthDashboardResponse.model_validate(result)
