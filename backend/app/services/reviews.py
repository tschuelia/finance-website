from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased, selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import BankAccount, Category, Contract, Transaction, User
from app.errors import ConflictError
from app.patterns import normalized_patterns
from app.services.access import list_visible_contracts
from app.services.categories import match_transaction_categories
from app.services.contracts import match_transaction_contracts
from app.services.matching import RuleMatch, patterns_match_clause


class ReviewIssue(StrEnum):
    ALL = "all"
    CATEGORY = "category"
    CONTRACT = "contract"


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


def _contract_candidate_clause(contract_id: int | None) -> ColumnElement[bool]:
    contract = aliased(Contract)
    clauses: list[ColumnElement[bool]] = [
        contract.owner_id == BankAccount.owner_id,
        or_(contract.start_date.is_(None), contract.start_date <= Transaction.date_issue),
        or_(contract.end_date.is_(None), contract.end_date >= Transaction.date_issue),
        patterns_match_clause(Transaction.recipient, Transaction.subject, contract.patterns),
    ]
    if contract_id is not None:
        clauses.append(contract.id == contract_id)
    return select(contract.id).where(*clauses).exists()


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
    category_open = Transaction.category_id.is_(None) & ~Transaction.category_reviewed
    contract_open = (
        Transaction.contract_id.is_(None)
        & ~Transaction.contract_reviewed
        & _contract_candidate_clause(contract_id)
    )
    clauses: list[ColumnElement[bool]] = [Transaction.bank_account_id.is_not(None)]
    if issue is ReviewIssue.CATEGORY:
        clauses.append(category_open)
    elif issue is ReviewIssue.CONTRACT:
        clauses.append(contract_open)
    else:
        clauses.append(category_open | contract_open)
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

    candidate_ids = (
        select(Transaction.id)
        .join(BankAccount, Transaction.bank_account_id == BankAccount.id)
        .where(*clauses)
    )
    total = session.scalar(select(func.count()).select_from(candidate_ids.subquery())) or 0
    total_pages = max(1, (total + page_size - 1) // page_size)
    effective_page = min(max(page, 1), total_pages)
    page_ids = tuple(
        int(transaction_id)
        for transaction_id in session.scalars(
            candidate_ids.order_by(Transaction.date_issue.desc(), Transaction.id.desc())
            .offset((effective_page - 1) * page_size)
            .limit(page_size)
        )
    )
    transactions_by_id = {
        transaction.id: transaction
        for transaction in session.scalars(
            select(Transaction)
            .options(
                selectinload(Transaction.bank_account).selectinload(BankAccount.owner),
                selectinload(Transaction.category),
                selectinload(Transaction.contract),
            )
            .where(Transaction.id.in_(page_ids))
        )
    }
    categories = tuple(session.scalars(select(Category).order_by(Category.name, Category.id)))
    contracts_by_owner: dict[int, list[Contract]] = {}
    for contract in list_visible_contracts(session, current_user):
        contracts_by_owner.setdefault(contract.owner_id, []).append(contract)

    items: list[AssignmentReviewItem] = []
    for transaction_id in page_ids:
        transaction = transactions_by_id[transaction_id]
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
        items.append(
            AssignmentReviewItem(
                transaction=transaction,
                account=account,
                category_match=category_match,
                contract_match=contract_match,
                issues=tuple(issues),
            )
        )
    return AssignmentReviewPage(
        items=tuple(items),
        page=effective_page,
        page_size=page_size,
        total=int(total),
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
    pattern_text = "\n".join(normalized)
    clauses: list[ColumnElement[bool]] = [
        patterns_match_clause(Transaction.recipient, Transaction.subject, pattern_text)
    ]
    if not current_user.is_superuser:
        clauses.append(BankAccount.owner_id == current_user.id)
    elif owner_id is not None:
        clauses.append(BankAccount.owner_id == owner_id)
    if start_date is not None:
        clauses.append(Transaction.date_issue >= start_date)
    if end_date is not None:
        clauses.append(Transaction.date_issue <= end_date)
    base = (
        select(Transaction, BankAccount)
        .join(BankAccount, Transaction.bank_account_id == BankAccount.id)
        .where(*clauses)
    )
    total = session.scalar(select(func.count()).select_from(base.subquery())) or 0
    examples = tuple(
        (transaction, account)
        for transaction, account in session.execute(
            base.order_by(Transaction.date_issue.desc(), Transaction.id.desc()).limit(5)
        ).all()
    )
    return PatternPreview(total=int(total), examples=examples)
