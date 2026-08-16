from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import func, or_, select, tuple_
from sqlalchemy.exc import IntegrityError
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

    @property
    def pair(self) -> tuple[int, int]:
        return self.outgoing_transaction_id, self.incoming_transaction_id


def confirmed_transfer_transaction_subquery():
    return (
        select(InternalTransferReview.outgoing_transaction_id.label("transaction_id"))
        .where(InternalTransferReview.status == TransferReviewStatus.CONFIRMED.value)
        .union_all(
            select(InternalTransferReview.incoming_transaction_id.label("transaction_id")).where(
                InternalTransferReview.status == TransferReviewStatus.CONFIRMED.value
            )
        )
        .subquery()
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


def _candidate_pair_query(
    current_user: User,
    status: TransferReviewStatus,
    *,
    owner_id: int | None,
    account_id: int | None,
    search_term: str | None,
):
    outgoing = aliased(Transaction)
    incoming = aliased(Transaction)
    outgoing_account = aliased(BankAccount)
    incoming_account = aliased(BankAccount)
    day_gap = func.abs(func.julianday(outgoing.date_issue) - func.julianday(incoming.date_issue))
    columns = (
        outgoing.id.label("outgoing_id"),
        incoming.id.label("incoming_id"),
        outgoing.date_issue.label("outgoing_date"),
        day_gap.label("day_gap"),
    )
    filters = (
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
    if status is not TransferReviewStatus.SUGGESTED:
        return (
            select(*columns)
            .select_from(InternalTransferReview)
            .join(outgoing, InternalTransferReview.outgoing_transaction_id == outgoing.id)
            .join(incoming, InternalTransferReview.incoming_transaction_id == incoming.id)
            .join(outgoing_account, outgoing.bank_account_id == outgoing_account.id)
            .join(incoming_account, incoming.bank_account_id == incoming_account.id)
            .where(InternalTransferReview.status == status.value, *filters)
        )

    reviewed_pair = (
        select(InternalTransferReview.id)
        .where(
            InternalTransferReview.outgoing_transaction_id == outgoing.id,
            InternalTransferReview.incoming_transaction_id == incoming.id,
        )
        .exists()
    )
    outgoing_confirmed = (
        select(InternalTransferReview.id)
        .where(
            InternalTransferReview.status == TransferReviewStatus.CONFIRMED.value,
            or_(
                InternalTransferReview.outgoing_transaction_id == outgoing.id,
                InternalTransferReview.incoming_transaction_id == outgoing.id,
            ),
        )
        .exists()
    )
    incoming_confirmed = (
        select(InternalTransferReview.id)
        .where(
            InternalTransferReview.status == TransferReviewStatus.CONFIRMED.value,
            or_(
                InternalTransferReview.outgoing_transaction_id == incoming.id,
                InternalTransferReview.incoming_transaction_id == incoming.id,
            ),
        )
        .exists()
    )
    return (
        select(*columns)
        .select_from(outgoing)
        .join(outgoing_account, outgoing.bank_account_id == outgoing_account.id)
        .join(incoming, incoming.amount == -outgoing.amount)
        .join(incoming_account, incoming.bank_account_id == incoming_account.id)
        .where(
            outgoing.amount < 0,
            incoming.amount > 0,
            outgoing.bank_account_id != incoming.bank_account_id,
            day_gap <= MAX_TRANSFER_DAY_GAP,
            ~reviewed_pair,
            ~outgoing_confirmed,
            ~incoming_confirmed,
            *filters,
        )
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
    candidates = _candidate_pair_query(
        current_user,
        status,
        owner_id=owner_id,
        account_id=account_id,
        search_term=search_term,
    ).subquery()
    total = session.scalar(select(func.count()).select_from(candidates)) or 0
    total_pages = max(1, (total + page_size - 1) // page_size)
    effective_page = min(max(page, 1), total_pages)
    ranked = select(
        candidates,
        func.count().over(partition_by=candidates.c.outgoing_id).label("outgoing_degree"),
        func.count().over(partition_by=candidates.c.incoming_id).label("incoming_degree"),
    ).subquery()
    page_rows = tuple(
        session.execute(
            select(ranked)
            .order_by(
                ranked.c.outgoing_date.desc(),
                ranked.c.outgoing_id.desc(),
                ranked.c.incoming_id.desc(),
            )
            .offset((effective_page - 1) * page_size)
            .limit(page_size)
        )
    )
    transaction_ids = {int(row[index]) for row in page_rows for index in (0, 1)}
    transactions = {
        transaction.id: transaction
        for transaction in session.scalars(
            select(Transaction)
            .options(
                selectinload(Transaction.bank_account).selectinload(BankAccount.owner),
                selectinload(Transaction.category),
                selectinload(Transaction.contract),
            )
            .where(Transaction.id.in_(transaction_ids))
        )
    }
    items = tuple(
        TransferPair(
            outgoing=transactions[int(row.outgoing_id)],
            incoming=transactions[int(row.incoming_id)],
            day_gap=int(row.day_gap),
            match_status=(
                TransferMatchStatus.UNIQUE
                if row.outgoing_degree == row.incoming_degree == 1
                else TransferMatchStatus.AMBIGUOUS
            ),
        )
        for row in page_rows
    )
    return TransferReviewPage(
        items=items,
        page=effective_page,
        page_size=page_size,
        total=int(total),
        total_pages=total_pages,
    )


def _visible_transactions(
    session: Session,
    current_user: User,
    transaction_ids: frozenset[int],
) -> dict[int, Transaction]:
    statement = (
        select(Transaction)
        .join(BankAccount, Transaction.bank_account_id == BankAccount.id)
        .where(Transaction.id.in_(transaction_ids))
    )
    if not current_user.is_superuser:
        statement = statement.where(BankAccount.owner_id == current_user.id)
    transactions = {transaction.id: transaction for transaction in session.scalars(statement)}
    if set(transactions) != set(transaction_ids):
        raise ConflictError("Mindestens eine Buchung ist nicht verfügbar.")
    return transactions


def _validate_transfer_pair(outgoing: Transaction, incoming: Transaction) -> None:
    if (
        outgoing.bank_account_id == incoming.bank_account_id
        or outgoing.amount >= 0
        or incoming.amount <= 0
        or outgoing.amount != -incoming.amount
        or abs((outgoing.date_issue - incoming.date_issue).days) > MAX_TRANSFER_DAY_GAP
    ):
        raise ConflictError("Die Buchungen bilden keine gültige Umbuchung.")


def review_transfer_pairs(
    session: Session,
    current_user: User,
    changes: tuple[TransferReviewChange, ...],
) -> int:
    pair_keys = tuple(change.pair for change in changes)
    if len(set(pair_keys)) != len(pair_keys):
        raise ConflictError("Eine Umbuchung darf pro Anfrage nur einmal geändert werden.")

    transaction_ids = frozenset(transaction_id for pair in pair_keys for transaction_id in pair)
    transactions = _visible_transactions(session, current_user, transaction_ids)
    existing_by_pair = {
        (review.outgoing_transaction_id, review.incoming_transaction_id): review
        for review in session.scalars(
            select(InternalTransferReview).where(
                tuple_(
                    InternalTransferReview.outgoing_transaction_id,
                    InternalTransferReview.incoming_transaction_id,
                ).in_(pair_keys)
            )
        )
    }

    confirmed_ids: set[int] = set()
    changed_pairs = set(pair_keys)
    for review in session.scalars(
        select(InternalTransferReview).where(
            InternalTransferReview.status == TransferReviewStatus.CONFIRMED.value
        )
    ):
        pair = (review.outgoing_transaction_id, review.incoming_transaction_id)
        if pair not in changed_pairs:
            confirmed_ids.update(pair)

    for change in changes:
        outgoing = transactions[change.outgoing_transaction_id]
        incoming = transactions[change.incoming_transaction_id]
        if change.action is not TransferReviewAction.RESET:
            _validate_transfer_pair(outgoing, incoming)
        if change.action is TransferReviewAction.CONFIRM:
            if outgoing.id in confirmed_ids or incoming.id in confirmed_ids:
                raise ConflictError("Mindestens eine Buchung ist bereits verknüpft.")
            confirmed_ids.update((outgoing.id, incoming.id))

    now = datetime.now(UTC).replace(tzinfo=None)
    for change in changes:
        existing = existing_by_pair.get(change.pair)
        if change.action is TransferReviewAction.RESET:
            if existing is not None:
                session.delete(existing)
            continue
        next_status = (
            TransferReviewStatus.CONFIRMED
            if change.action is TransferReviewAction.CONFIRM
            else TransferReviewStatus.REJECTED
        )
        if existing is None:
            session.add(
                InternalTransferReview(
                    outgoing_transaction_id=change.outgoing_transaction_id,
                    incoming_transaction_id=change.incoming_transaction_id,
                    status=next_status.value,
                    reviewed_by_id=current_user.id,
                    reviewed_at=now,
                )
            )
        else:
            existing.status = next_status.value
            existing.reviewed_by_id = current_user.id
            existing.reviewed_at = now
    try:
        session.flush()
    except IntegrityError:
        raise ConflictError("Mindestens eine Buchung ist bereits verknüpft.") from None
    return len(changes)
