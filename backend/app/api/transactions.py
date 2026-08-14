from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_csrf
from app.db import request_session
from app.db.models import Transaction, User
from app.errors import ConflictError
from app.schemas.transactions import (
    TransactionFilterQuery,
    TransactionPageResponse,
    TransactionResponse,
    TransactionSummaryResponse,
    TransactionWrite,
)
from app.services.access import get_visible_account_transaction
from app.services.transactions import (
    TransactionFilters,
    TransactionValues,
    delete_transaction,
    get_transaction_page,
    update_transaction,
)

router = APIRouter(prefix="/accounts/{account_id}/transactions", tags=["transactions"])
CurrentUser = Annotated[User, Depends(get_current_user)]
CsrfUser = Annotated[User, Depends(require_csrf)]
DatabaseSession = Annotated[Session, Depends(request_session)]


def transaction_response(transaction: Transaction) -> TransactionResponse:
    return TransactionResponse(
        id=transaction.id,
        bank_account_id=transaction.bank_account_id,
        recipient=transaction.recipient,
        amount=transaction.amount,
        subject=transaction.subject,
        date_issue=transaction.date_issue,
        date_booking=transaction.date_booking,
        full_subject_string=transaction.full_subject_string,
        category_id=transaction.category_id,
        category_name=transaction.category.name if transaction.category is not None else None,
        contract_id=transaction.contract_id,
        contract_name=transaction.contract.name if transaction.contract is not None else None,
    )


def transaction_values(account_id: int, payload: TransactionWrite) -> TransactionValues:
    if payload.bank_account_id != account_id:
        raise ConflictError("Das ausgewählte Konto stimmt nicht mit der Route überein.")
    return TransactionValues(
        # The Django bulk form wrote the placeholder for every omitted
        # recipient, including CSV rows. Keep that rollback-compatible value.
        recipient=payload.recipient or "unbekannt",
        amount=payload.amount,
        subject=payload.subject,
        date_issue=payload.date_issue,
        date_booking=payload.date_booking,
        full_subject_string=payload.full_subject_string or payload.subject,
        category_id=payload.category_id,
        contract_id=payload.contract_id,
    )


@router.get("", response_model=TransactionPageResponse)
def transaction_list(
    account_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
    query: Annotated[TransactionFilterQuery, Query()],
) -> TransactionPageResponse:
    result = get_transaction_page(
        session,
        current_user,
        account_id,
        TransactionFilters(
            search_term=query.q,
            date_start=query.date_start,
            date_end=query.date_end,
            amount_min=query.amount_min,
            amount_max=query.amount_max,
            category_ids=tuple(query.category_ids),
            transaction_type=query.transaction_type,
        ),
        page=query.page,
        page_size=query.page_size,
    )
    return TransactionPageResponse(
        items=[transaction_response(transaction) for transaction in result.items],
        page=result.page,
        page_size=result.page_size,
        total=result.total,
        total_pages=result.total_pages,
        summary=TransactionSummaryResponse(
            total=result.summary.total,
            paid=result.summary.paid,
            received=result.summary.received,
            minimum_date=result.summary.minimum_date,
            maximum_date=result.summary.maximum_date,
        ),
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
def transaction_detail(
    account_id: int,
    transaction_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
) -> TransactionResponse:
    transaction = get_visible_account_transaction(
        session,
        current_user,
        account_id,
        transaction_id,
    )
    return transaction_response(transaction)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def transaction_update(
    account_id: int,
    transaction_id: int,
    payload: TransactionWrite,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> TransactionResponse:
    transaction = update_transaction(
        session,
        current_user,
        account_id,
        transaction_id,
        transaction_values(account_id, payload),
    )
    return transaction_response(transaction)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def transaction_delete(
    account_id: int,
    transaction_id: int,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> Response:
    delete_transaction(session, current_user, account_id, transaction_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
