from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_csrf
from app.db import request_session
from app.db.models import Category, User
from app.schemas.categories import (
    CategoryResponse,
    CategoryWrite,
    RecategorizationResponse,
)
from app.services.categories import (
    create_category,
    list_categories,
    reassign_account_categories,
    update_category,
)

router = APIRouter(tags=["categories"])
CurrentUser = Annotated[User, Depends(get_current_user)]
CsrfUser = Annotated[User, Depends(require_csrf)]
DatabaseSession = Annotated[Session, Depends(request_session)]


def category_response(category: Category) -> CategoryResponse:
    return CategoryResponse(
        id=category.id,
        name=category.name,
        patterns=category.patterns,
    )


@router.get("/categories", response_model=list[CategoryResponse])
def category_list(
    _current_user: CurrentUser,
    session: DatabaseSession,
) -> list[CategoryResponse]:
    return [category_response(category) for category in list_categories(session)]


@router.post(
    "/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def category_create(
    payload: CategoryWrite,
    _current_user: CsrfUser,
    session: DatabaseSession,
) -> CategoryResponse:
    return category_response(create_category(session, name=payload.name, patterns=payload.patterns))


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def category_update(
    category_id: int,
    payload: CategoryWrite,
    _current_user: CsrfUser,
    session: DatabaseSession,
) -> CategoryResponse:
    return category_response(
        update_category(
            session,
            category_id,
            name=payload.name,
            patterns=payload.patterns,
        )
    )


@router.post(
    "/accounts/{account_id}/recategorize",
    response_model=RecategorizationResponse,
)
def account_recategorize(
    account_id: int,
    current_user: CsrfUser,
    session: DatabaseSession,
) -> RecategorizationResponse:
    return RecategorizationResponse(
        changed=reassign_account_categories(session, current_user, account_id)
    )
