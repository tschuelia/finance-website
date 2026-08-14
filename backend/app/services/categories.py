from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Category
from app.errors import ConflictError, ResourceNotFoundError


def category_patterns(category: Category) -> tuple[str, ...]:
    return tuple(pattern.strip() for pattern in category.patterns.split("\n"))


def matches_any_pattern(value: str | None, patterns: Iterable[str]) -> bool:
    normalized_value = (value or "").lower()
    return any(pattern.lower() in normalized_value for pattern in patterns)


def _matching_category(
    value: str | None, categories: tuple[tuple[Category, tuple[str, ...]], ...]
) -> Category | None:
    for category, patterns in categories:
        if matches_any_pattern(value, patterns):
            return category
    return None


def match_transaction_category(
    recipient: str | None,
    subject: str | None,
    categories: Iterable[Category],
) -> Category | None:
    category_patterns_by_id = tuple(
        (category, category_patterns(category))
        for category in sorted(categories, key=lambda c: c.id)
    )
    return _matching_category(recipient, category_patterns_by_id) or _matching_category(
        subject, category_patterns_by_id
    )


def list_categories(session: Session) -> tuple[Category, ...]:
    return tuple(session.scalars(select(Category).order_by(Category.name, Category.id)))


def create_category(session: Session, *, name: str, patterns: str) -> Category:
    category = Category(name=name, patterns=patterns)
    session.add(category)
    try:
        session.flush()
    except IntegrityError:
        raise ConflictError("Eine Kategorie mit diesem Namen existiert bereits.") from None
    return category


def update_category(
    session: Session,
    category_id: int,
    *,
    name: str,
    patterns: str,
) -> Category:
    category = session.get(Category, category_id)
    if category is None:
        raise ResourceNotFoundError()
    category.name = name
    category.patterns = patterns
    try:
        session.flush()
    except IntegrityError:
        raise ConflictError("Eine Kategorie mit diesem Namen existiert bereits.") from None
    return category
