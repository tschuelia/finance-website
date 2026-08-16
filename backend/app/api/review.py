from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.transactions import transaction_response
from app.auth.dependencies import get_current_user, require_csrf
from app.db import request_session
from app.db.models import User
from app.schemas.accounts import UserSummary
from app.schemas.matching import rule_match_response
from app.schemas.transactions import (
    AssignmentBulkUpdate,
    AssignmentBulkUpdateResponse,
    AssignmentReviewPageResponse,
    AssignmentReviewQuery,
    AssignmentReviewRowResponse,
    PatternPreviewExampleResponse,
    PatternPreviewRequest,
    PatternPreviewResponse,
)
from app.schemas.transfers import (
    TransferPairResponse,
    TransferReviewPageResponse,
    TransferReviewQuery,
    TransferReviewUpdateRequest,
    TransferReviewUpdateResponse,
)
from app.services.reviews import (
    bulk_update_assignments,
    get_assignment_review_page,
    preview_patterns,
)
from app.services.transfers import (
    TransferReviewChange,
    get_transfer_review_page,
    review_transfer_pairs,
)

router = APIRouter(prefix="/transactions/review", tags=["assignment-review"])
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


@router.get("/transfers", response_model=TransferReviewPageResponse)
def transfer_review_list(
    current_user: CurrentUser,
    session: DatabaseSession,
    query: Annotated[TransferReviewQuery, Query()],
) -> TransferReviewPageResponse:
    result = get_transfer_review_page(
        session,
        current_user,
        status=query.status,
        owner_id=query.owner_id,
        account_id=query.account_id,
        search_term=query.q,
        page=query.page,
        page_size=query.page_size,
    )
    return TransferReviewPageResponse(
        items=[
            TransferPairResponse(
                outgoing=transaction_response(item.outgoing),
                outgoing_owner=_user_summary(item.outgoing.bank_account.owner),
                incoming=transaction_response(item.incoming),
                incoming_owner=_user_summary(item.incoming.bank_account.owner),
                day_gap=item.day_gap,
                match_status=item.match_status,
            )
            for item in result.items
            if item.outgoing.bank_account is not None and item.incoming.bank_account is not None
        ],
        page=result.page,
        page_size=result.page_size,
        total=result.total,
        total_pages=result.total_pages,
    )


@router.patch("/transfers", response_model=TransferReviewUpdateResponse)
def transfer_review_update(
    payload: TransferReviewUpdateRequest,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> TransferReviewUpdateResponse:
    updated = review_transfer_pairs(
        session,
        current_user,
        tuple(
            TransferReviewChange(
                outgoing_transaction_id=item.outgoing_transaction_id,
                incoming_transaction_id=item.incoming_transaction_id,
                action=item.action,
            )
            for item in payload.items
        ),
    )
    return TransferReviewUpdateResponse(updated=updated)


@router.get("", response_model=AssignmentReviewPageResponse)
def assignment_review_list(
    current_user: CurrentUser,
    session: DatabaseSession,
    query: Annotated[AssignmentReviewQuery, Query()],
) -> AssignmentReviewPageResponse:
    result = get_assignment_review_page(
        session,
        current_user,
        issue=query.issue,
        owner_id=query.owner_id,
        account_id=query.account_id,
        contract_id=query.contract_id,
        search_term=query.q,
        page=query.page,
        page_size=query.page_size,
    )
    return AssignmentReviewPageResponse(
        items=[
            AssignmentReviewRowResponse(
                transaction=transaction_response(item.transaction),
                account_name=item.account.name,
                owner=UserSummary(
                    id=item.account.owner.id,
                    username=item.account.owner.username,
                    first_name=item.account.owner.first_name,
                    last_name=item.account.owner.last_name,
                    is_superuser=item.account.owner.is_superuser,
                ),
                category_match=rule_match_response(item.category_match),
                contract_match=rule_match_response(item.contract_match),
                issues=list(item.issues),
            )
            for item in result.items
        ],
        page=result.page,
        page_size=result.page_size,
        total=result.total,
        total_pages=result.total_pages,
    )


@router.patch("", response_model=AssignmentBulkUpdateResponse)
def assignment_review_update(
    payload: AssignmentBulkUpdate,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> AssignmentBulkUpdateResponse:
    updated = bulk_update_assignments(
        session,
        current_user,
        tuple(dict.fromkeys(payload.transaction_ids)),
        set_category=payload.set_category,
        category_id=payload.category_id,
        set_contract=payload.set_contract,
        contract_id=payload.contract_id,
    )
    return AssignmentBulkUpdateResponse(updated=len(updated))


@router.post("/patterns/preview", response_model=PatternPreviewResponse)
def assignment_pattern_preview(
    payload: PatternPreviewRequest,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> PatternPreviewResponse:
    result = preview_patterns(
        session,
        current_user,
        payload.patterns,
        owner_id=payload.owner_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    return PatternPreviewResponse(
        total=result.total,
        examples=[
            PatternPreviewExampleResponse(
                id=transaction.id,
                recipient=transaction.recipient,
                subject=transaction.subject,
                date_issue=transaction.date_issue,
                account_name=account.name,
            )
            for transaction, account in result.examples
        ],
    )
