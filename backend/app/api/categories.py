from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_superuser_csrf
from app.db import request_session
from app.db.models import Category, User
from app.schemas.categories import (
    CategoryResponse,
    CategoryWrite,
)
from app.services.categories import (
    create_category,
    list_categories,
    update_category,
)

router = APIRouter(tags=["categories"])
CurrentUser = Annotated[User, Depends(get_current_user)]
CategoryAdmin = Annotated[User, Depends(require_superuser_csrf)]
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
    _current_user: CategoryAdmin,
    session: DatabaseSession,
) -> CategoryResponse:
    return category_response(create_category(session, name=payload.name, patterns=payload.patterns))


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def category_update(
    category_id: int,
    payload: CategoryWrite,
    _current_user: CategoryAdmin,
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
