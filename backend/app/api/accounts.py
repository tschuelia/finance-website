from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_csrf
from app.db import request_session
from app.db.models import BankAccount, BankDepot, User
from app.schemas.accounts import (
    AccountDetailResponse,
    AccountSummary,
    DepotAssetResponse,
    DepotAssetTransactionResponse,
    DepotAssetUpdate,
    DepotDetailResponse,
    DepotSummary,
    PortfolioGroupResponse,
    PortfolioOverviewResponse,
    UserSummary,
)
from app.services.access import get_visible_bank_account, list_visible_users
from app.services.accounts import get_account_financials, get_portfolio_overview
from app.services.depots import (
    get_depot_asset_financials,
    get_depot_financials,
    get_depot_overview,
    update_depot_asset,
)

router = APIRouter(tags=["accounts"])
CurrentUser = Annotated[User, Depends(get_current_user)]
CsrfUser = Annotated[User, Depends(require_csrf)]
DatabaseSession = Annotated[Session, Depends(request_session)]


def _user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_superuser=user.is_superuser,
    )


def _account_summary(
    session: Session,
    current_user: User,
    account: BankAccount,
) -> AccountSummary:
    financials = get_account_financials(session, current_user, account.id)
    return AccountSummary(
        id=account.id,
        name=account.name,
        bank=account.bank,
        current_amount=account.current_amount,
        balance=financials.balance,
        oldest_transaction_date=financials.oldest_transaction_date,
        newest_transaction_date=financials.newest_transaction_date,
        maximum_absolute_transaction_amount=financials.maximum_absolute_transaction_amount,
    )


def _depot_summary(
    session: Session,
    current_user: User,
    depot: BankDepot,
) -> DepotSummary:
    financials = get_depot_financials(session, current_user, depot.id)
    return DepotSummary(
        id=depot.id,
        name=depot.name,
        balance=financials.balance,
        last_update=financials.last_update,
    )


@router.get("/accounts", response_model=PortfolioOverviewResponse)
def account_overview(
    current_user: CurrentUser,
    session: DatabaseSession,
) -> PortfolioOverviewResponse:
    overview = get_portfolio_overview(session, current_user)
    return PortfolioOverviewResponse(
        groups=[
            PortfolioGroupResponse(
                owner=_user_summary(group.owner),
                accounts=[
                    _account_summary(session, current_user, account) for account in group.accounts
                ],
                depots=[_depot_summary(session, current_user, depot) for depot in group.depots],
                balance=group.balance,
            )
            for group in overview.groups
        ],
        total_balance=overview.total_balance,
    )


@router.get("/users", response_model=list[UserSummary])
def user_list(
    current_user: CurrentUser,
    session: DatabaseSession,
) -> list[UserSummary]:
    return [_user_summary(user) for user in list_visible_users(session, current_user)]


@router.get("/accounts/{account_id}", response_model=AccountDetailResponse)
def account_detail(
    account_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
) -> AccountDetailResponse:
    account = get_visible_bank_account(session, current_user, account_id)
    summary = _account_summary(session, current_user, account)
    return AccountDetailResponse(
        id=summary.id,
        name=summary.name,
        bank=summary.bank,
        current_amount=summary.current_amount,
        balance=summary.balance,
        oldest_transaction_date=summary.oldest_transaction_date,
        newest_transaction_date=summary.newest_transaction_date,
        maximum_absolute_transaction_amount=summary.maximum_absolute_transaction_amount,
        owner=_user_summary(account.owner),
    )


@router.get("/depots/{depot_id}", response_model=DepotDetailResponse)
def depot_detail(
    depot_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
) -> DepotDetailResponse:
    overview = get_depot_overview(session, current_user, depot_id)
    return DepotDetailResponse(
        id=overview.depot.id,
        name=overview.depot.name,
        owner=_user_summary(overview.depot.owner),
        balance=overview.financials.balance,
        last_update=overview.financials.last_update,
        assets=[
            DepotAssetResponse(
                id=item.asset.id,
                name=item.asset.name,
                current_balance=item.asset.current_balance,
                last_update=item.asset.last_update,
                transaction_total=sum(
                    (transaction.amount for transaction in item.transactions),
                    start=item.asset.current_balance * 0,
                ),
                transactions=[
                    DepotAssetTransactionResponse(
                        id=transaction.id,
                        amount=transaction.amount,
                        date_issue=transaction.date_issue,
                    )
                    for transaction in item.transactions
                ],
            )
            for item in overview.assets
        ],
    )


@router.patch(
    "/depots/{depot_id}/assets/{asset_id}",
    response_model=DepotAssetResponse,
)
def update_asset(
    depot_id: int,
    asset_id: int,
    payload: DepotAssetUpdate,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> DepotAssetResponse:
    asset = update_depot_asset(
        session,
        current_user,
        depot_id,
        asset_id,
        current_balance=payload.current_balance,
        last_update=payload.last_update,
    )
    financials = get_depot_asset_financials(session, current_user, depot_id, asset.id)
    return DepotAssetResponse(
        id=asset.id,
        name=asset.name,
        current_balance=asset.current_balance,
        last_update=asset.last_update,
        transaction_total=financials.transaction_total,
        transactions=[
            DepotAssetTransactionResponse(
                id=transaction.id,
                amount=transaction.amount,
                date_issue=transaction.date_issue,
            )
            for transaction in sorted(
                asset.transactions,
                key=lambda item: (item.date_issue, item.id),
                reverse=True,
            )
        ],
    )
