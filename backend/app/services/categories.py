from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Category
from app.errors import ConflictError, ResourceNotFoundError
from app.patterns import match_patterns, normalized_patterns
from app.services.matching import (
    MatchCandidate,
    RuleMatch,
    rule_match,
)
from app.services.review_invalidation import invalidate_category_reviews


def category_patterns(category: Category) -> tuple[str, ...]:
    return normalized_patterns(category.patterns)


def match_transaction_categories(
    recipient: str | None,
    subject: str | None,
    categories: Iterable[Category],
) -> RuleMatch:
    candidates = tuple(
        MatchCandidate(
            id=category.id,
            name=category.name,
            matched_patterns=matched,
        )
        for category in sorted(categories, key=lambda item: (item.name.casefold(), item.id))
        if (matched := match_patterns(recipient, subject, category_patterns(category)))
    )
    return rule_match(candidates)


def match_transaction_category(
    recipient: str | None,
    subject: str | None,
    categories: Iterable[Category],
) -> Category | None:
    categories_by_id = {category.id: category for category in categories}
    result = match_transaction_categories(recipient, subject, categories_by_id.values())
    if len(result.candidates) != 1:
        return None
    return categories_by_id[result.candidates[0].id]


def list_categories(session: Session) -> tuple[Category, ...]:
    return tuple(session.scalars(select(Category).order_by(Category.name, Category.id)))


def create_category(session: Session, *, name: str, patterns: str) -> Category:
    normalized = "\n".join(normalized_patterns(patterns))
    category = Category(name=name, patterns=normalized)
    session.add(category)
    try:
        session.flush()
    except IntegrityError:
        raise ConflictError("Eine Kategorie mit diesem Namen existiert bereits.") from None
    invalidate_category_reviews(session, normalized)
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
    previous_patterns = category.patterns
    next_patterns = "\n".join(normalized_patterns(patterns))
    category.name = name
    category.patterns = next_patterns
    try:
        session.flush()
    except IntegrityError:
        raise ConflictError("Eine Kategorie mit diesem Namen existiert bereits.") from None
    if previous_patterns != next_patterns:
        invalidate_category_reviews(session, previous_patterns, next_patterns)
    return category
