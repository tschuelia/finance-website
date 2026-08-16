from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from conftest import add_account, add_user
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import InternalTransferReview, Transaction
from app.errors import ConflictError
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


def test_transfer_reset_cannot_delete_another_users_review(session: Session) -> None:
    owner = add_user(session, "owner")
    other = add_user(session, "other")
    source = add_account(session, owner, name="Giro")
    target = add_account(session, owner, name="Sparen")
    outgoing = _transaction(session, source.id, "-100.00", date(2026, 1, 1))
    incoming = _transaction(session, target.id, "100.00", date(2026, 1, 2))
    review = InternalTransferReview(
        outgoing_transaction_id=outgoing.id,
        incoming_transaction_id=incoming.id,
        status="confirmed",
        reviewed_by_id=owner.id,
        reviewed_at=datetime.now(UTC).replace(tzinfo=None),
    )
    session.add(review)
    session.flush()

    with pytest.raises(ConflictError, match="nicht verfügbar"):
        review_transfer_pairs(
            session,
            other,
            (
                TransferReviewChange(
                    outgoing_transaction_id=outgoing.id,
                    incoming_transaction_id=incoming.id,
                    action=TransferReviewAction.RESET,
                ),
            ),
        )

    assert session.get(InternalTransferReview, review.id) is review
    assert review.status == "confirmed"


def test_conflicting_transfer_batch_is_atomic(session: Session) -> None:
    owner = add_user(session, "owner")
    source = add_account(session, owner, name="Giro")
    first_target = add_account(session, owner, name="Sparen")
    second_target = add_account(session, owner, name="Depot")
    outgoing = _transaction(session, source.id, "-100.00", date(2026, 1, 1))
    first_incoming = _transaction(session, first_target.id, "100.00", date(2026, 1, 2))
    second_incoming = _transaction(session, second_target.id, "100.00", date(2026, 1, 3))

    with pytest.raises(ConflictError, match="bereits verknüpft"):
        review_transfer_pairs(
            session,
            owner,
            (
                TransferReviewChange(
                    outgoing_transaction_id=outgoing.id,
                    incoming_transaction_id=first_incoming.id,
                    action=TransferReviewAction.CONFIRM,
                ),
                TransferReviewChange(
                    outgoing_transaction_id=outgoing.id,
                    incoming_transaction_id=second_incoming.id,
                    action=TransferReviewAction.CONFIRM,
                ),
            ),
        )

    assert session.query(InternalTransferReview).count() == 0


def test_duplicate_transfer_pair_request_returns_422(
    app_client: TestClient,
    session: Session,
) -> None:
    owner = add_user(session, "owner")
    source = add_account(session, owner, name="Giro")
    target = add_account(session, owner, name="Sparen")
    outgoing = _transaction(session, source.id, "-100.00", date(2026, 1, 1))
    incoming = _transaction(session, target.id, "100.00", date(2026, 1, 2))
    session.commit()
    login = app_client.post(
        "/api/v1/auth/login",
        json={"username": owner.username, "password": "test-password"},
    )
    csrf_token = str(login.json()["csrf_token"])
    item = {
        "outgoing_transaction_id": outgoing.id,
        "incoming_transaction_id": incoming.id,
        "action": "confirm",
    }

    response = app_client.patch(
        "/api/v1/transactions/review/transfers",
        json={"items": [item, item]},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 422
