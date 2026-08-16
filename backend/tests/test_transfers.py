from datetime import date
from decimal import Decimal

from conftest import add_account, add_user
from sqlalchemy.orm import Session

from app.db.models import Transaction
from app.services.transfers import (
    TransferReviewAction,
    TransferReviewChange,
    TransferReviewStatus,
    get_transfer_review_page,
    review_transfer_pairs,
)


def _transaction(session: Session, account_id: int, amount: str, issue_date: date) -> Transaction:
    transaction = Transaction(
        bank_account_id=account_id,
        recipient="Empfänger",
        amount=Decimal(amount),
        subject="Betreff",
        date_issue=issue_date,
        date_booking=None,
        full_subject_string="Betreff",
        category_id=None,
        contract_id=None,
    )
    session.add(transaction)
    session.flush()
    return transaction


def test_transfer_suggestions_require_review_before_confirmation(session: Session) -> None:
    user = add_user(session, "owner")
    source = add_account(session, user, name="Giro")
    target = add_account(session, user, name="Sparen")
    outgoing = _transaction(session, source.id, "-100.00", date(2026, 1, 1))
    incoming = _transaction(session, target.id, "100.00", date(2026, 1, 3))

    suggestions = get_transfer_review_page(session, user)
    assert suggestions.total == 1
    assert suggestions.items[0].match_status.value == "unique"

    updated = review_transfer_pairs(
        session,
        user,
        (
            TransferReviewChange(
                outgoing_transaction_id=outgoing.id,
                incoming_transaction_id=incoming.id,
                action=TransferReviewAction.CONFIRM,
            ),
        ),
    )
    assert updated == 1
    assert get_transfer_review_page(session, user).total == 0
    assert (
        get_transfer_review_page(
            session,
            user,
            status=TransferReviewStatus.CONFIRMED,
        ).total
        == 1
    )
