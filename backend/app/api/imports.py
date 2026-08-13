from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.api.transactions import transaction_response, transaction_values
from app.auth.dependencies import get_current_user, require_csrf
from app.db import request_session
from app.db.models import User
from app.errors import InvalidImportError
from app.imports import CsvImportError
from app.schemas.imports import CsvCommitRequest, CsvCommitResponse, CsvPreviewResponse
from app.schemas.transactions import TransactionWrite
from app.services.imports import preview_csv_import
from app.services.transactions import create_transactions

router = APIRouter(prefix="/accounts/{account_id}/transactions/import", tags=["csv-imports"])
CurrentUser = Annotated[User, Depends(get_current_user)]
CsrfUser = Annotated[User, Depends(require_csrf)]
DatabaseSession = Annotated[Session, Depends(request_session)]


@router.post("/preview", response_model=CsvPreviewResponse)
def csv_preview(
    account_id: int,
    upload: Annotated[UploadFile, File()],
    current_user: CurrentUser,
    session: DatabaseSession,
) -> CsvPreviewResponse:
    try:
        rows = preview_csv_import(
            session,
            current_user,
            account_id,
            upload.file.read(),
        )
    except CsvImportError as exc:
        raise InvalidImportError(str(exc)) from None
    return CsvPreviewResponse(
        items=[
            TransactionWrite(
                bank_account_id=account_id,
                recipient=row.transaction.recipient,
                amount=row.transaction.amount,
                subject=row.transaction.subject,
                date_issue=row.transaction.date_issue,
                date_booking=row.transaction.date_booking,
                full_subject_string=row.transaction.full_subject_string,
                category_id=row.category_id,
                contract_id=None,
            )
            for row in rows
        ]
    )


@router.post("/commit", response_model=CsvCommitResponse, status_code=status.HTTP_201_CREATED)
def csv_commit(
    account_id: int,
    payload: CsvCommitRequest,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> CsvCommitResponse:
    values = tuple(transaction_values(account_id, item) for item in payload.items)
    transactions = create_transactions(session, current_user, account_id, values)
    return CsvCommitResponse(
        items=[transaction_response(transaction) for transaction in transactions],
        created=len(transactions),
    )
