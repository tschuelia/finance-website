from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Category, Transaction
from app.errors import ConflictError, ResourceNotFoundError
from app.services.matching import (
    MatchCandidate,
    RuleMatch,
    match_patterns,
    normalized_patterns,
    rule_match,
)


def category_patterns(category: Category) -> tuple[str, ...]:
    return normalized_patterns(category.patterns)


def matches_any_pattern(value: str | None, patterns: Iterable[str]) -> bool:
    normalized_value = (value or "").casefold()
    return any(pattern and pattern.casefold() in normalized_value for pattern in patterns)


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
    category = Category(name=name, patterns="\n".join(normalized_patterns(patterns)))
    session.add(category)
    try:
        session.flush()
    except IntegrityError:
        raise ConflictError("Eine Kategorie mit diesem Namen existiert bereits.") from None
    session.query(Transaction).filter(Transaction.category_id.is_(None)).update(
        {Transaction.category_reviewed: False}
    )
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
    category.patterns = "\n".join(normalized_patterns(patterns))
    try:
        session.flush()
    except IntegrityError:
        raise ConflictError("Eine Kategorie mit diesem Namen existiert bereits.") from None
    session.query(Transaction).filter(Transaction.category_id.is_(None)).update(
        {Transaction.category_reviewed: False}
    )
    return category
