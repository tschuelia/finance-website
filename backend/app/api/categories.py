from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_superuser_csrf
from app.db import request_session
from app.db.models import BankAccount, Category, Transaction, User
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


def category_response(category: Category, *, assigned_count: int = 0) -> CategoryResponse:
    return CategoryResponse(
        id=category.id,
        name=category.name,
        patterns=category.patterns,
        assigned_count=assigned_count,
    )


def _assigned_count(session: Session, current_user: User, category_id: int) -> int:
    statement = (
        select(func.count())
        .select_from(Transaction)
        .join(BankAccount, Transaction.bank_account_id == BankAccount.id)
        .where(Transaction.category_id == category_id)
    )
    if not current_user.is_superuser:
        statement = statement.where(BankAccount.owner_id == current_user.id)
    return session.scalar(statement) or 0


@router.get("/categories", response_model=list[CategoryResponse])
def category_list(
    current_user: CurrentUser,
    session: DatabaseSession,
) -> list[CategoryResponse]:
    return [
        category_response(
            category,
            assigned_count=_assigned_count(session, current_user, category.id),
        )
        for category in list_categories(session)
    ]


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
