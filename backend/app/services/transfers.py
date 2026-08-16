from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.db.models import BankAccount, InternalTransferReview, Transaction, User
from app.errors import ConflictError

MAX_TRANSFER_DAY_GAP = 3


class TransferReviewStatus(StrEnum):
    SUGGESTED = "suggested"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class TransferReviewAction(StrEnum):
    CONFIRM = "confirm"
    REJECT = "reject"
    RESET = "reset"


class TransferMatchStatus(StrEnum):
    UNIQUE = "unique"
    AMBIGUOUS = "ambiguous"


@dataclass(frozen=True, slots=True)
class TransferPair:
    outgoing: Transaction
    incoming: Transaction
    day_gap: int
    match_status: TransferMatchStatus


@dataclass(frozen=True, slots=True)
class TransferReviewPage:
    items: tuple[TransferPair, ...]
    page: int
    page_size: int
    total: int
    total_pages: int


@dataclass(frozen=True, slots=True)
class TransferReviewChange:
    outgoing_transaction_id: int
    incoming_transaction_id: int
    action: TransferReviewAction


def confirmed_transfer_transaction_ids(
    session: Session,
    account_ids: tuple[int, ...] | None = None,
) -> frozenset[int]:
    statement = select(
        InternalTransferReview.outgoing_transaction_id,
        InternalTransferReview.incoming_transaction_id,
    ).where(InternalTransferReview.status == TransferReviewStatus.CONFIRMED.value)
    if account_ids is not None:
        outgoing = aliased(Transaction)
        incoming = aliased(Transaction)
        statement = (
            statement.join(
                outgoing,
                InternalTransferReview.outgoing_transaction_id == outgoing.id,
            )
            .join(
                incoming,
                InternalTransferReview.incoming_transaction_id == incoming.id,
            )
            .where(
                or_(
                    outgoing.bank_account_id.in_(account_ids),
                    incoming.bank_account_id.in_(account_ids),
                )
            )
        )
    return frozenset(
        transaction_id
        for outgoing_id, incoming_id in session.execute(statement)
        for transaction_id in (int(outgoing_id), int(incoming_id))
    )


def invalidate_transfer_reviews(session: Session, transaction_id: int) -> None:
    reviews = tuple(
        session.scalars(
            select(InternalTransferReview).where(
                or_(
                    InternalTransferReview.outgoing_transaction_id == transaction_id,
                    InternalTransferReview.incoming_transaction_id == transaction_id,
                )
            )
        )
    )
    for review in reviews:
        session.delete(review)


def _visible_account_clause(current_user: User, account: type[BankAccount]):
    if current_user.is_superuser:
        return account.id.is_not(None)
    return account.owner_id == current_user.id


def _pair_filters(
    *,
    owner_id: int | None,
    account_id: int | None,
    search_term: str | None,
    outgoing: type[Transaction],
    incoming: type[Transaction],
    outgoing_account: type[BankAccount],
    incoming_account: type[BankAccount],
):
    clauses = []
    if owner_id is not None:
        clauses.append(
            or_(outgoing_account.owner_id == owner_id, incoming_account.owner_id == owner_id)
        )
    if account_id is not None:
        clauses.append(or_(outgoing_account.id == account_id, incoming_account.id == account_id))
    if search_term:
        clauses.append(
            or_(
                outgoing.recipient.contains(search_term, autoescape=True),
                outgoing.subject.contains(search_term, autoescape=True),
                incoming.recipient.contains(search_term, autoescape=True),
                incoming.subject.contains(search_term, autoescape=True),
            )
        )
    return tuple(clauses)


def _transaction_options():
    return (
        selectinload(Transaction.bank_account).selectinload(BankAccount.owner),
        selectinload(Transaction.category),
        selectinload(Transaction.contract),
        selectinload(Transaction.outgoing_transfer_reviews),
        selectinload(Transaction.incoming_transfer_reviews),
    )


def _suggested_pairs(
    session: Session,
    current_user: User,
    *,
    owner_id: int | None,
    account_id: int | None,
    search_term: str | None,
) -> tuple[tuple[Transaction, Transaction, int], ...]:
    outgoing = aliased(Transaction)
    incoming = aliased(Transaction)
    outgoing_account = aliased(BankAccount)
    incoming_account = aliased(BankAccount)
    day_gap = func.abs(func.julianday(outgoing.date_issue) - func.julianday(incoming.date_issue))
    statement = (
        select(outgoing.id, incoming.id, day_gap)
        .join(outgoing_account, outgoing.bank_account_id == outgoing_account.id)
        .join(incoming, incoming.amount == -outgoing.amount)
        .join(incoming_account, incoming.bank_account_id == incoming_account.id)
        .where(
            outgoing.amount < 0,
            incoming.amount > 0,
            outgoing.bank_account_id != incoming.bank_account_id,
            day_gap <= MAX_TRANSFER_DAY_GAP,
            _visible_account_clause(current_user, outgoing_account),
            _visible_account_clause(current_user, incoming_account),
            *_pair_filters(
                owner_id=owner_id,
                account_id=account_id,
                search_term=search_term,
                outgoing=outgoing,
                incoming=incoming,
                outgoing_account=outgoing_account,
                incoming_account=incoming_account,
            ),
        )
        .order_by(outgoing.date_issue.desc(), outgoing.id.desc(), incoming.id.desc())
    )
    raw = tuple(
        (int(outgoing_id), int(incoming_id), int(gap))
        for outgoing_id, incoming_id, gap in session.execute(statement)
    )
    if not raw:
        return ()

    reviewed_pairs = {
        (review.outgoing_transaction_id, review.incoming_transaction_id)
        for review in session.scalars(select(InternalTransferReview))
    }
    confirmed_ids = confirmed_transfer_transaction_ids(session)
    pending = tuple(
        item
        for item in raw
        if (item[0], item[1]) not in reviewed_pairs
        and item[0] not in confirmed_ids
        and item[1] not in confirmed_ids
    )
    transaction_ids = {item[index] for item in pending for index in (0, 1)}
    transactions = {
        transaction.id: transaction
        for transaction in session.scalars(
            select(Transaction)
            .options(*_transaction_options())
            .where(Transaction.id.in_(transaction_ids))
        )
    }
    return tuple(
        (transactions[outgoing_id], transactions[incoming_id], gap)
        for outgoing_id, incoming_id, gap in pending
    )


def _reviewed_pairs(
    session: Session,
    current_user: User,
    status: TransferReviewStatus,
    *,
    owner_id: int | None,
    account_id: int | None,
    search_term: str | None,
) -> tuple[tuple[Transaction, Transaction, int], ...]:
    outgoing = aliased(Transaction)
    incoming = aliased(Transaction)
    outgoing_account = aliased(BankAccount)
    incoming_account = aliased(BankAccount)
    day_gap = func.abs(func.julianday(outgoing.date_issue) - func.julianday(incoming.date_issue))
    statement = (
        select(outgoing.id, incoming.id, day_gap)
        .select_from(InternalTransferReview)
        .join(outgoing, InternalTransferReview.outgoing_transaction_id == outgoing.id)
        .join(incoming, InternalTransferReview.incoming_transaction_id == incoming.id)
        .join(outgoing_account, outgoing.bank_account_id == outgoing_account.id)
        .join(incoming_account, incoming.bank_account_id == incoming_account.id)
        .where(
            InternalTransferReview.status == status.value,
            _visible_account_clause(current_user, outgoing_account),
            _visible_account_clause(current_user, incoming_account),
            *_pair_filters(
                owner_id=owner_id,
                account_id=account_id,
                search_term=search_term,
                outgoing=outgoing,
                incoming=incoming,
                outgoing_account=outgoing_account,
                incoming_account=incoming_account,
            ),
        )
        .order_by(outgoing.date_issue.desc(), outgoing.id.desc())
    )
    raw = tuple(
        (int(outgoing_id), int(incoming_id), int(gap))
        for outgoing_id, incoming_id, gap in session.execute(statement)
    )
    transaction_ids = {item[index] for item in raw for index in (0, 1)}
    transactions = {
        transaction.id: transaction
        for transaction in session.scalars(
            select(Transaction)
            .options(*_transaction_options())
            .where(Transaction.id.in_(transaction_ids))
        )
    }
    return tuple(
        (transactions[outgoing_id], transactions[incoming_id], gap)
        for outgoing_id, incoming_id, gap in raw
    )


def get_transfer_review_page(
    session: Session,
    current_user: User,
    *,
    status: TransferReviewStatus = TransferReviewStatus.SUGGESTED,
    owner_id: int | None = None,
    account_id: int | None = None,
    search_term: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> TransferReviewPage:
    raw = (
        _suggested_pairs(
            session,
            current_user,
            owner_id=owner_id,
            account_id=account_id,
            search_term=search_term,
        )
        if status is TransferReviewStatus.SUGGESTED
        else _reviewed_pairs(
            session,
            current_user,
            status,
            owner_id=owner_id,
            account_id=account_id,
            search_term=search_term,
        )
    )
    degrees: dict[int, int] = {}
    for outgoing, incoming, _ in raw:
        degrees[outgoing.id] = degrees.get(outgoing.id, 0) + 1
        degrees[incoming.id] = degrees.get(incoming.id, 0) + 1
    items = tuple(
        TransferPair(
            outgoing=outgoing,
            incoming=incoming,
            day_gap=day_gap,
            match_status=(
                TransferMatchStatus.UNIQUE
                if degrees[outgoing.id] == degrees[incoming.id] == 1
                else TransferMatchStatus.AMBIGUOUS
            ),
        )
        for outgoing, incoming, day_gap in raw
    )
    total = len(items)
    total_pages = max(1, (total + page_size - 1) // page_size)
    effective_page = min(max(page, 1), total_pages)
    start = (effective_page - 1) * page_size
    return TransferReviewPage(
        items=items[start : start + page_size],
        page=effective_page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


def _visible_pair_transactions(
    session: Session,
    current_user: User,
    outgoing_id: int,
    incoming_id: int,
) -> tuple[Transaction, Transaction]:
    transactions = {
        transaction.id: transaction
        for transaction in session.scalars(
            select(Transaction)
            .join(BankAccount, Transaction.bank_account_id == BankAccount.id)
            .options(selectinload(Transaction.bank_account))
            .where(
                Transaction.id.in_((outgoing_id, incoming_id)),
                _visible_account_clause(current_user, BankAccount),
            )
        )
    }
    if set(transactions) != {outgoing_id, incoming_id}:
        raise ConflictError("Mindestens eine Buchung ist nicht verfügbar.")
    return transactions[outgoing_id], transactions[incoming_id]


def review_transfer_pairs(
    session: Session,
    current_user: User,
    changes: tuple[TransferReviewChange, ...],
) -> int:
    now = datetime.now(UTC).replace(tzinfo=None)
    changed = 0
    for change in changes:
        existing = session.scalar(
            select(InternalTransferReview).where(
                InternalTransferReview.outgoing_transaction_id == change.outgoing_transaction_id,
                InternalTransferReview.incoming_transaction_id == change.incoming_transaction_id,
            )
        )
        if change.action is TransferReviewAction.RESET:
            if existing is not None:
                session.delete(existing)
                changed += 1
            continue

        outgoing, incoming = _visible_pair_transactions(
            session,
            current_user,
            change.outgoing_transaction_id,
            change.incoming_transaction_id,
        )
        if (
            outgoing.bank_account_id == incoming.bank_account_id
            or outgoing.amount >= 0
            or incoming.amount <= 0
            or outgoing.amount != -incoming.amount
            or abs((outgoing.date_issue - incoming.date_issue).days) > MAX_TRANSFER_DAY_GAP
        ):
            raise ConflictError("Die Buchungen bilden keine gültige Umbuchung.")

        next_status = (
            TransferReviewStatus.CONFIRMED
            if change.action is TransferReviewAction.CONFIRM
            else TransferReviewStatus.REJECTED
        )
        if next_status is TransferReviewStatus.CONFIRMED:
            conflict = session.scalar(
                select(InternalTransferReview.id).where(
                    InternalTransferReview.status == TransferReviewStatus.CONFIRMED.value,
                    or_(
                        InternalTransferReview.outgoing_transaction_id == outgoing.id,
                        InternalTransferReview.incoming_transaction_id == incoming.id,
                    ),
                    or_(
                        InternalTransferReview.outgoing_transaction_id != outgoing.id,
                        InternalTransferReview.incoming_transaction_id != incoming.id,
                    ),
                )
            )
            if conflict is not None:
                raise ConflictError("Mindestens eine Buchung ist bereits verknüpft.")

        if existing is None:
            existing = InternalTransferReview(
                outgoing_transaction_id=outgoing.id,
                incoming_transaction_id=incoming.id,
                status=next_status.value,
                reviewed_by_id=current_user.id,
                reviewed_at=now,
            )
            session.add(existing)
        else:
            existing.status = next_status.value
            existing.reviewed_by_id = current_user.id
            existing.reviewed_at = now
        changed += 1
    session.flush()
    return changed
