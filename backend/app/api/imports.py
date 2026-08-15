from typing import Annotated

from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.transactions import transaction_response, transaction_values
from app.auth.dependencies import get_current_user, require_csrf
from app.db import request_session
from app.db.models import User
from app.errors import InvalidImportError
from app.imports import CsvImportError
from app.schemas.imports import (
    CsvCommitRequest,
    CsvCommitResponse,
    CsvPreviewResponse,
    CsvPreviewRowResponse,
    CsvSkippedRowResponse,
)
from app.schemas.matching import rule_match_response
from app.schemas.transactions import TransactionWrite
from app.services.imports import preview_csv_import
from app.services.transactions import create_transactions
from app.uploads import read_limited_upload

router = APIRouter(prefix="/accounts/{account_id}/transactions/import", tags=["csv-imports"])
CurrentUser = Annotated[User, Depends(get_current_user)]
CsrfUser = Annotated[User, Depends(require_csrf)]
DatabaseSession = Annotated[Session, Depends(request_session)]


@router.post("/preview", response_model=CsvPreviewResponse)
def csv_preview(
    request: Request,
    account_id: int,
    upload: Annotated[UploadFile, File()],
    current_user: CurrentUser,
    session: DatabaseSession,
) -> CsvPreviewResponse:
    try:
        preview = preview_csv_import(
            session,
            current_user,
            account_id,
            read_limited_upload(
                upload.file,
                maximum_bytes=request.app.state.settings.csv_upload_max_bytes,
            ),
        )
    except CsvImportError as exc:
        raise InvalidImportError(str(exc)) from None
    return CsvPreviewResponse(
        items=[
            CsvPreviewRowResponse(
                source_row=row.transaction.source_row,
                transaction=TransactionWrite(
                    bank_account_id=account_id,
                    recipient=row.transaction.recipient,
                    amount=row.transaction.amount,
                    subject=row.transaction.subject,
                    date_issue=row.transaction.date_issue,
                    date_booking=row.transaction.date_booking,
                    full_subject_string=row.transaction.full_subject_string,
                    category_id=row.category_id,
                    contract_id=row.contract_id,
                    category_reviewed=row.category_id is not None,
                    contract_reviewed=row.contract_match.status != "ambiguous",
                ),
                category_match=rule_match_response(row.category_match),
                contract_match=rule_match_response(row.contract_match),
            )
            for row in preview.rows
        ],
        skipped_rows=[
            CsvSkippedRowResponse(source_row=row.source_row, reason=row.reason)
            for row in preview.skipped_rows
        ],
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
