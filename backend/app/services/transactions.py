from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import BankAccount, Category, Contract, Transaction, User
from app.errors import ConflictError
from app.services.access import (
    get_visible_account_transaction,
    get_visible_bank_account,
    list_visible_contracts,
)
from app.services.categories import match_transaction_categories
from app.services.contracts import match_transaction_contracts
from app.services.matching import RuleMatch, match_patterns, normalized_patterns
from app.services.transfers import invalidate_transfer_reviews

DEFAULT_TRANSACTION_PAGE_SIZE = 100
ZERO = Decimal("0")


class TransactionType(StrEnum):
    ALL = "all"
    INCOME = "income"
    EXPENSE = "expense"


class ReviewIssue(StrEnum):
    ALL = "all"
    CATEGORY = "category"
    CONTRACT = "contract"


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
class AssignmentReviewItem:
    transaction: Transaction
    account: BankAccount
    category_match: RuleMatch
    contract_match: RuleMatch
    issues: tuple[ReviewIssue, ...]


@dataclass(frozen=True, slots=True)
class AssignmentReviewPage:
    items: tuple[AssignmentReviewItem, ...]
    page: int
    page_size: int
    total: int
    total_pages: int


@dataclass(frozen=True, slots=True)
class PatternPreview:
    total: int
    examples: tuple[tuple[Transaction, BankAccount], ...]


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
    category_reviewed: bool = False
    contract_reviewed: bool = False


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
    date_start = filters.date_start if filters.date_start is not None else oldest_date
    date_end = filters.date_end if filters.date_end is not None else today
    amount_min = filters.amount_min if filters.amount_min is not None else ZERO
    amount_max = filters.amount_max if filters.amount_max is not None else maximum_amount

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
            .options(
                selectinload(Transaction.category),
                selectinload(Transaction.contract),
                selectinload(Transaction.bank_account),
                selectinload(Transaction.outgoing_transfer_reviews),
                selectinload(Transaction.incoming_transfer_reviews),
            )
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
    rows: tuple[TransactionValues, ...],
    *,
    account_owner_id: int,
    allowed_existing_contract_ids: frozenset[int] = frozenset(),
) -> None:
    category_ids = {row.category_id for row in rows if row.category_id is not None}
    existing_category_ids = set(
        session.scalars(select(Category.id).where(Category.id.in_(category_ids)))
    )
    if existing_category_ids != category_ids:
        raise ConflictError("Die ausgewählte Kategorie existiert nicht mehr.")

    contract_ids = {row.contract_id for row in rows if row.contract_id is not None}
    contract_statement = select(Contract).where(Contract.id.in_(contract_ids))
    if not current_user.is_superuser:
        contract_statement = contract_statement.where(Contract.owner_id == current_user.id)
    visible_contracts = {contract.id: contract for contract in session.scalars(contract_statement)}
    visible_contract_ids = set(visible_contracts)
    if visible_contract_ids != contract_ids:
        raise ConflictError("Der ausgewählte Vertrag existiert nicht mehr.")
    if any(
        contract.owner_id != account_owner_id and contract.id not in allowed_existing_contract_ids
        for contract in visible_contracts.values()
    ):
        raise ConflictError("Der ausgewählte Vertrag gehört nicht zum Konto.")


def _apply_values(transaction: Transaction, values: TransactionValues) -> None:
    transaction.recipient = values.recipient
    transaction.amount = values.amount
    transaction.subject = values.subject
    transaction.date_issue = values.date_issue
    transaction.date_booking = values.date_booking
    transaction.full_subject_string = values.full_subject_string
    transaction.category_id = values.category_id
    transaction.contract_id = values.contract_id
    transaction.category_reviewed = values.category_reviewed
    transaction.contract_reviewed = values.contract_reviewed


def create_transactions(
    session: Session,
    current_user: User,
    account_id: int,
    rows: tuple[TransactionValues, ...],
) -> tuple[Transaction, ...]:
    account = get_visible_bank_account(session, current_user, account_id)
    _validate_relationships(
        session,
        current_user,
        rows,
        account_owner_id=account.owner_id,
    )

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
            category_reviewed=values.category_reviewed,
            contract_reviewed=values.contract_reviewed,
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
    account = get_visible_bank_account(session, current_user, account_id)
    transaction = get_visible_account_transaction(
        session,
        current_user,
        account_id,
        transaction_id,
    )
    _validate_relationships(
        session,
        current_user,
        (values,),
        account_owner_id=account.owner_id,
        allowed_existing_contract_ids=(
            frozenset({transaction.contract_id})
            if transaction.contract_id is not None
            else frozenset()
        ),
    )
    if transaction.amount != values.amount or transaction.date_issue != values.date_issue:
        invalidate_transfer_reviews(session, transaction.id)
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


def get_assignment_review_page(
    session: Session,
    current_user: User,
    *,
    issue: ReviewIssue = ReviewIssue.ALL,
    owner_id: int | None = None,
    account_id: int | None = None,
    contract_id: int | None = None,
    search_term: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> AssignmentReviewPage:
    clauses: list[ColumnElement[bool]] = [Transaction.bank_account_id.is_not(None)]
    category_clause = Transaction.category_id.is_(None) & ~Transaction.category_reviewed
    contract_clause = Transaction.contract_id.is_(None) & ~Transaction.contract_reviewed
    if issue is ReviewIssue.CATEGORY:
        clauses.append(category_clause)
    elif issue is ReviewIssue.CONTRACT:
        clauses.append(contract_clause)
    else:
        clauses.append(category_clause | contract_clause)
    if not current_user.is_superuser:
        clauses.append(BankAccount.owner_id == current_user.id)
    elif owner_id is not None:
        clauses.append(BankAccount.owner_id == owner_id)
    if account_id is not None:
        clauses.append(BankAccount.id == account_id)
    if search_term:
        clauses.append(
            or_(
                Transaction.recipient.contains(search_term, autoescape=True),
                Transaction.subject.contains(search_term, autoescape=True),
            )
        )

    categories = tuple(session.scalars(select(Category).order_by(Category.name, Category.id)))
    contracts_by_owner: dict[int, list[Contract]] = {}
    for contract in list_visible_contracts(session, current_user):
        contracts_by_owner.setdefault(contract.owner_id, []).append(contract)

    transactions = session.scalars(
        select(Transaction)
        .join(BankAccount, Transaction.bank_account_id == BankAccount.id)
        .options(
            selectinload(Transaction.bank_account).selectinload(BankAccount.owner),
            selectinload(Transaction.category),
            selectinload(Transaction.contract),
        )
        .where(*clauses)
        .order_by(Transaction.date_issue.desc(), Transaction.id.desc())
    )
    review_items: list[AssignmentReviewItem] = []
    for transaction in transactions:
        account = transaction.bank_account
        if account is None:
            continue
        category_match = match_transaction_categories(
            transaction.recipient,
            transaction.subject,
            categories,
        )
        contract_match = match_transaction_contracts(
            transaction.recipient,
            transaction.subject,
            transaction.date_issue,
            tuple(contracts_by_owner.get(account.owner_id, ())),
        )
        issues: list[ReviewIssue] = []
        if transaction.category_id is None and not transaction.category_reviewed:
            issues.append(ReviewIssue.CATEGORY)
        if (
            transaction.contract_id is None
            and not transaction.contract_reviewed
            and contract_match.candidates
        ):
            issues.append(ReviewIssue.CONTRACT)
        if not issues or (issue is not ReviewIssue.ALL and issue not in issues):
            continue
        if contract_id is not None and all(
            candidate.id != contract_id for candidate in contract_match.candidates
        ):
            continue
        review_items.append(
            AssignmentReviewItem(
                transaction=transaction,
                account=account,
                category_match=category_match,
                contract_match=contract_match,
                issues=tuple(issues),
            )
        )

    total = len(review_items)
    total_pages = max(1, (total + page_size - 1) // page_size)
    effective_page = min(page, total_pages)
    start = (effective_page - 1) * page_size
    return AssignmentReviewPage(
        items=tuple(review_items[start : start + page_size]),
        page=effective_page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


def bulk_update_assignments(
    session: Session,
    current_user: User,
    transaction_ids: tuple[int, ...],
    *,
    set_category: bool,
    category_id: int | None,
    set_contract: bool,
    contract_id: int | None,
) -> tuple[Transaction, ...]:
    statement = (
        select(Transaction)
        .join(BankAccount, Transaction.bank_account_id == BankAccount.id)
        .options(selectinload(Transaction.bank_account))
        .where(Transaction.id.in_(transaction_ids))
    )
    if not current_user.is_superuser:
        statement = statement.where(BankAccount.owner_id == current_user.id)
    transactions = tuple(session.scalars(statement))
    if {transaction.id for transaction in transactions} != set(transaction_ids):
        raise ConflictError("Mindestens eine ausgewählte Transaktion ist nicht mehr verfügbar.")

    if set_category and category_id is not None and session.get(Category, category_id) is None:
        raise ConflictError("Die ausgewählte Kategorie existiert nicht mehr.")

    contract = session.get(Contract, contract_id) if set_contract and contract_id else None
    if set_contract and contract_id is not None:
        if contract is None or (
            not current_user.is_superuser and contract.owner_id != current_user.id
        ):
            raise ConflictError("Der ausgewählte Vertrag existiert nicht mehr.")
        if any(
            transaction.bank_account is None
            or transaction.bank_account.owner_id != contract.owner_id
            for transaction in transactions
        ):
            raise ConflictError("Der ausgewählte Vertrag gehört nicht zu allen Konten.")

    for transaction in transactions:
        if set_category:
            transaction.category_id = category_id
            transaction.category_reviewed = True
        if set_contract:
            transaction.contract_id = contract_id
            transaction.contract_reviewed = True
    session.flush()
    return transactions


def preview_patterns(
    session: Session,
    current_user: User,
    patterns: str,
    *,
    owner_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> PatternPreview:
    normalized = normalized_patterns(patterns)
    if not normalized:
        return PatternPreview(total=0, examples=())
    clauses: list[ColumnElement[bool]] = []
    if not current_user.is_superuser:
        clauses.append(BankAccount.owner_id == current_user.id)
    elif owner_id is not None:
        clauses.append(BankAccount.owner_id == owner_id)
    if start_date is not None:
        clauses.append(Transaction.date_issue >= start_date)
    if end_date is not None:
        clauses.append(Transaction.date_issue <= end_date)
    rows = session.execute(
        select(Transaction, BankAccount)
        .join(BankAccount, Transaction.bank_account_id == BankAccount.id)
        .where(*clauses)
        .order_by(Transaction.date_issue.desc(), Transaction.id.desc())
    )
    matches = tuple(
        (transaction, account)
        for transaction, account in rows
        if match_patterns(transaction.recipient, transaction.subject, normalized)
    )
    return PatternPreview(total=len(matches), examples=matches[:5])
