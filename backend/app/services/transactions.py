from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import Category, Transaction, User
from app.errors import ConflictError, ResourceNotFoundError
from app.services.access import (
    get_visible_account_transaction,
    get_visible_bank_account,
    get_visible_contract,
)

DEFAULT_TRANSACTION_PAGE_SIZE = 100
ZERO = Decimal("0")


class TransactionType(StrEnum):
    ALL = "all"
    INCOME = "income"
    EXPENSE = "expense"


@dataclass(frozen=True, slots=True)
class TransactionFilters:
    search_term: str | None = None
    date_start: date | None = None
    date_end: date | None = None
    amount_min: Decimal | None = None
    amount_max: Decimal | None = None
    category_ids: tuple[int, ...] = field(default_factory=tuple)
    transaction_type: TransactionType = TransactionType.ALL


@dataclass(frozen=True, slots=True)
class TransactionSummary:
    total: Decimal
    paid: Decimal
    received: Decimal
    minimum_date: date | None
    maximum_date: date | None


@dataclass(frozen=True, slots=True)
class TransactionPage:
    items: tuple[Transaction, ...]
    page: int
    page_size: int
    total: int
    total_pages: int
    summary: TransactionSummary


@dataclass(frozen=True, slots=True)
class TransactionValues:
    recipient: str
    amount: Decimal
    subject: str
    date_issue: date
    date_booking: date | None
    full_subject_string: str
    category_id: int | None = None
    contract_id: int | None = None


def _decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _account_filter_bounds(session: Session, account_id: int, today: date) -> tuple[date, Decimal]:
    oldest_date, maximum_amount = session.execute(
        select(
            func.min(Transaction.date_issue),
            func.max(func.abs(Transaction.amount)),
        ).where(Transaction.bank_account_id == account_id)
    ).one()
    return oldest_date or today, _decimal(maximum_amount)


def transaction_filter_clauses(
    session: Session,
    account_id: int,
    filters: TransactionFilters,
    today: date,
) -> tuple[ColumnElement[bool], ...]:
    oldest_date, maximum_amount = _account_filter_bounds(session, account_id, today)
    date_start = filters.date_start or oldest_date
    date_end = filters.date_end or today
    amount_min = filters.amount_min or ZERO
    amount_max = filters.amount_max or maximum_amount

    clauses: list[ColumnElement[bool]] = [
        Transaction.bank_account_id == account_id,
        Transaction.date_issue.between(date_start, date_end),
        func.abs(Transaction.amount).between(amount_min, amount_max),
    ]
    if filters.search_term is not None:
        clauses.append(
            or_(
                Transaction.recipient.contains(filters.search_term, autoescape=True),
                Transaction.subject.contains(filters.search_term, autoescape=True),
            )
        )
    if filters.category_ids:
        clauses.append(Transaction.category_id.in_(filters.category_ids))
    if filters.transaction_type is TransactionType.INCOME:
        clauses.append(Transaction.amount >= ZERO)
    elif filters.transaction_type is TransactionType.EXPENSE:
        clauses.append(Transaction.amount < ZERO)
    elif filters.transaction_type is not TransactionType.ALL:
        raise ValueError(f"Unrecognized transaction type: {filters.transaction_type}")
    return tuple(clauses)


def get_transaction_page(
    session: Session,
    current_user: User,
    account_id: int,
    filters: TransactionFilters | None = None,
    *,
    page: int = 1,
    page_size: int = DEFAULT_TRANSACTION_PAGE_SIZE,
    today: date | None = None,
) -> TransactionPage:
    if page < 1:
        raise ValueError("page must be at least 1")
    if page_size < 1:
        raise ValueError("page_size must be at least 1")

    account = get_visible_bank_account(session, current_user, account_id)
    clauses = transaction_filter_clauses(
        session,
        account.id,
        filters or TransactionFilters(),
        today or date.today(),
    )
    total = session.scalar(select(func.count()).select_from(Transaction).where(*clauses)) or 0
    total_pages = max(1, (total + page_size - 1) // page_size)
    effective_page = min(page, total_pages)

    summary_values = session.execute(
        select(
            func.sum(Transaction.amount),
            func.sum(case((Transaction.amount < ZERO, Transaction.amount), else_=ZERO)),
            func.sum(case((Transaction.amount > ZERO, Transaction.amount), else_=ZERO)),
            func.min(Transaction.date_issue),
            func.max(Transaction.date_issue),
        ).where(*clauses)
    ).one()
    items = tuple(
        session.scalars(
            select(Transaction)
            .where(*clauses)
            .order_by(
                Transaction.date_issue.desc(),
                Transaction.date_booking.desc(),
                Transaction.recipient.desc(),
                Transaction.id.desc(),
            )
            .offset((effective_page - 1) * page_size)
            .limit(page_size)
        )
    )
    return TransactionPage(
        items=items,
        page=effective_page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        summary=TransactionSummary(
            total=_decimal(summary_values[0]),
            paid=_decimal(summary_values[1]),
            received=_decimal(summary_values[2]),
            minimum_date=summary_values[3],
            maximum_date=summary_values[4],
        ),
    )


def _validate_relationships(
    session: Session,
    current_user: User,
    values: TransactionValues,
) -> None:
    if values.category_id is not None and session.get(Category, values.category_id) is None:
        raise ConflictError("Die ausgewählte Kategorie existiert nicht mehr.")
    if values.contract_id is None:
        return
    try:
        get_visible_contract(session, current_user, values.contract_id)
    except ResourceNotFoundError:
        raise ConflictError("Der ausgewählte Vertrag existiert nicht mehr.") from None


def _apply_values(transaction: Transaction, values: TransactionValues) -> None:
    transaction.recipient = values.recipient
    transaction.amount = values.amount
    transaction.subject = values.subject
    transaction.date_issue = values.date_issue
    transaction.date_booking = values.date_booking
    transaction.full_subject_string = values.full_subject_string
    transaction.category_id = values.category_id
    transaction.contract_id = values.contract_id


def create_transactions(
    session: Session,
    current_user: User,
    account_id: int,
    rows: tuple[TransactionValues, ...],
) -> tuple[Transaction, ...]:
    account = get_visible_bank_account(session, current_user, account_id)
    for values in rows:
        _validate_relationships(session, current_user, values)

    transactions: list[Transaction] = []
    for values in rows:
        transaction = Transaction(
            bank_account_id=account.id,
            recipient=values.recipient,
            amount=values.amount,
            subject=values.subject,
            date_issue=values.date_issue,
            date_booking=values.date_booking,
            full_subject_string=values.full_subject_string,
            category_id=values.category_id,
            contract_id=values.contract_id,
        )
        session.add(transaction)
        transactions.append(transaction)
    session.flush()
    return tuple(transactions)


def update_transaction(
    session: Session,
    current_user: User,
    account_id: int,
    transaction_id: int,
    values: TransactionValues,
) -> Transaction:
    transaction = get_visible_account_transaction(
        session,
        current_user,
        account_id,
        transaction_id,
    )
    _validate_relationships(session, current_user, values)
    _apply_values(transaction, values)
    session.flush()
    return transaction


def delete_transaction(
    session: Session,
    current_user: User,
    account_id: int,
    transaction_id: int,
) -> None:
    transaction = get_visible_account_transaction(
        session,
        current_user,
        account_id,
        transaction_id,
    )
    session.delete(transaction)
    session.flush()
