from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.transactions import transaction_response
from app.auth.dependencies import get_current_user, require_csrf
from app.config import Settings
from app.db import request_session
from app.db.models import Contract, ContractFile, User
from app.schemas.accounts import UserSummary
from app.schemas.contracts import (
    ContractDetailQuery,
    ContractDetailResponse,
    ContractFileResponse,
    ContractListResponse,
    ContractSummaryResponse,
    ContractTransactionPageResponse,
    ContractWrite,
)
from app.services.contracts import (
    create_contract,
    delete_contract_file,
    get_contract_detail,
    grouped_contracts,
    resolve_contract_file,
    store_contract_file,
    update_contract,
)

router = APIRouter(prefix="/contracts", tags=["contracts"])
CurrentUser = Annotated[User, Depends(get_current_user)]
CsrfUser = Annotated[User, Depends(require_csrf)]
DatabaseSession = Annotated[Session, Depends(request_session)]


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _summary(contract: Contract) -> ContractSummaryResponse:
    return ContractSummaryResponse(
        id=contract.id,
        name=contract.name,
        owner=UserSummary(
            id=contract.owner.id,
            username=contract.owner.username,
            first_name=contract.owner.first_name,
            last_name=contract.owner.last_name,
            is_superuser=contract.owner.is_superuser,
        ),
        description=contract.description,
        is_active=contract.is_active,
        start_date=contract.start_date,
        end_date=contract.end_date,
    )


def _file_response(contract_file: ContractFile) -> ContractFileResponse:
    return ContractFileResponse(
        id=contract_file.id,
        filename=contract_file.filename,
        download_url=(
            f"/api/v1/contracts/{contract_file.contract_id}/files/{contract_file.id}/download"
        ),
    )


@router.get("", response_model=ContractListResponse)
def contract_list(
    current_user: CurrentUser,
    session: DatabaseSession,
) -> ContractListResponse:
    active, inactive = grouped_contracts(session, current_user)
    return ContractListResponse(
        active=[_summary(contract) for contract in active],
        inactive=[_summary(contract) for contract in inactive],
    )


@router.post("", response_model=ContractSummaryResponse, status_code=status.HTTP_201_CREATED)
def contract_create(
    payload: ContractWrite,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> ContractSummaryResponse:
    return _summary(
        create_contract(
            session,
            current_user,
            owner_id=payload.owner_id,
            name=payload.name,
            description=payload.description,
            is_active=payload.is_active,
            start_date=payload.start_date,
            end_date=payload.end_date,
        )
    )


@router.get("/{contract_id}", response_model=ContractDetailResponse)
def contract_detail(
    contract_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
    query: Annotated[ContractDetailQuery, Query()],
) -> ContractDetailResponse:
    detail = get_contract_detail(
        session,
        current_user,
        contract_id,
        page=query.page,
        page_size=query.page_size,
    )
    summary = _summary(detail.contract)
    return ContractDetailResponse(
        **summary.model_dump(),
        balance=detail.financials.balance,
        first_transaction_date=(detail.financials.first_transaction_date),
        last_transaction_date=(detail.financials.last_transaction_date),
        transactions=ContractTransactionPageResponse(
            items=[transaction_response(transaction) for transaction in detail.transactions.items],
            page=detail.transactions.page,
            page_size=detail.transactions.page_size,
            total=detail.transactions.total,
            total_pages=detail.transactions.total_pages,
        ),
        files=[_file_response(contract_file) for contract_file in detail.files],
    )


@router.put("/{contract_id}", response_model=ContractSummaryResponse)
def contract_update(
    contract_id: int,
    payload: ContractWrite,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> ContractSummaryResponse:
    return _summary(
        update_contract(
            session,
            current_user,
            contract_id,
            owner_id=payload.owner_id,
            name=payload.name,
            description=payload.description,
            is_active=payload.is_active,
            start_date=payload.start_date,
            end_date=payload.end_date,
        )
    )


@router.post(
    "/{contract_id}/files",
    response_model=ContractFileResponse,
    status_code=status.HTTP_201_CREATED,
)
def contract_file_upload(
    request: Request,
    contract_id: int,
    current_user: CsrfUser,
    session: DatabaseSession,
    upload: Annotated[UploadFile, File()],
) -> ContractFileResponse:
    contract_file = store_contract_file(
        session,
        current_user,
        contract_id,
        _settings(request).media_root,
        filename=upload.filename or "",
        source=upload.file,
        maximum_bytes=_settings(request).contract_upload_max_bytes,
    )
    return _file_response(contract_file)


@router.get("/{contract_id}/files/{file_id}/download", response_class=FileResponse)
def contract_file_download(
    request: Request,
    contract_id: int,
    file_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
) -> FileResponse:
    contract_file, path = resolve_contract_file(
        session,
        current_user,
        contract_id,
        file_id,
        _settings(request).media_root,
    )
    return FileResponse(
        path=Path(path),
        filename=contract_file.filename,
        media_type="application/octet-stream",
    )


@router.delete("/{contract_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def contract_file_delete(
    request: Request,
    contract_id: int,
    file_id: int,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> Response:
    delete_contract_file(
        session,
        current_user,
        contract_id,
        file_id,
        _settings(request).media_root,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
