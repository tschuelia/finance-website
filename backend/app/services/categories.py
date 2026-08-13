from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Category, Transaction, User
from app.services.access import get_visible_bank_account


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


def reassign_account_categories(
    session: Session,
    current_user: User,
    account_id: int,
) -> int:
    account = get_visible_bank_account(session, current_user, account_id)
    categories = tuple(session.scalars(select(Category).order_by(Category.id)))
    transactions = session.scalars(
        select(Transaction)
        .where(Transaction.bank_account_id == account.id)
        .order_by(Transaction.id)
    )

    changed = 0
    for transaction in transactions:
        category = match_transaction_category(
            transaction.recipient,
            transaction.subject,
            categories,
        )
        category_id = category.id if category is not None else None
        if transaction.category_id != category_id:
            transaction.category_id = category_id
            changed += 1
    return changed
