from datetime import date
from decimal import Decimal

import pytest
from conftest import add_account, add_contract, add_user
from sqlalchemy.orm import Session

from app.db.models import Category, Transaction
from app.errors import ConflictError
from app.services.transactions import (
    ReviewIssue,
    TransactionFilters,
    TransactionType,
    TransactionValues,
    bulk_update_assignments,
    create_transactions,
    get_assignment_review_page,
    get_transaction_page,
    preview_patterns,
    update_transaction,
)


def _values(*, contract_id: int | None = None, category_id: int | None = None) -> TransactionValues:
    return TransactionValues(
        recipient="Empfänger",
        amount=Decimal("10.00"),
        subject="Betreff",
        date_issue=date(2026, 1, 1),
        date_booking=None,
        full_subject_string="Betreff",
        category_id=category_id,
        contract_id=contract_id,
    )


def _transaction(account_id: int) -> Transaction:
    values = _values()
    return Transaction(
        bank_account_id=account_id,
        recipient=values.recipient,
        amount=values.amount,
        subject=values.subject,
        date_issue=values.date_issue,
        date_booking=values.date_booking,
        full_subject_string=values.full_subject_string,
        category_id=values.category_id,
        contract_id=values.contract_id,
    )


def test_zero_amount_max_is_not_treated_as_absent(session: Session) -> None:
    user = add_user(session, "owner")
    account = add_account(session, user)
    session.add(_transaction(account.id))
    session.flush()

    result = get_transaction_page(
        session,
        user,
        account.id,
        TransactionFilters(amount_max=Decimal("0")),
        today=date(2026, 1, 2),
    )

    assert result.total == 0


def test_zero_negative_and_positive_amount_ranges(session: Session) -> None:
    user = add_user(session, "owner")
    account = add_account(session, user)
    for amount in (Decimal("-10.00"), Decimal("0.00"), Decimal("5.00")):
        transaction = _transaction(account.id)
        transaction.amount = amount
        session.add(transaction)
    session.flush()

    zero_only = get_transaction_page(
        session,
        user,
        account.id,
        TransactionFilters(amount_min=Decimal("0"), amount_max=Decimal("0")),
        today=date(2026, 1, 2),
    )
    normal_range = get_transaction_page(
        session,
        user,
        account.id,
        TransactionFilters(amount_min=Decimal("1"), amount_max=Decimal("10")),
        today=date(2026, 1, 2),
    )
    income = get_transaction_page(
        session,
        user,
        account.id,
        TransactionFilters(transaction_type=TransactionType.INCOME),
        today=date(2026, 1, 2),
    )

    assert [item.amount for item in zero_only.items] == [Decimal("0")]
    assert {item.amount for item in normal_range.items} == {Decimal("-10"), Decimal("5")}
    assert {item.amount for item in income.items} == {Decimal("0"), Decimal("5")}


def test_bulk_relationship_validation_rejects_inaccessible_contract(session: Session) -> None:
    owner = add_user(session, "owner")
    other_owner = add_user(session, "other")
    account = add_account(session, owner)
    contract = add_contract(session, other_owner)

    with pytest.raises(ConflictError, match="existiert nicht mehr"):
        create_transactions(session, owner, account.id, (_values(contract_id=contract.id),))


def test_bulk_relationship_validation_accepts_existing_shared_category(session: Session) -> None:
    owner = add_user(session, "owner")
    account = add_account(session, owner)
    contract = add_contract(session, owner)
    category = Category(name="Wohnen", patterns="miete")
    session.add(category)
    session.flush()

    created = create_transactions(
        session,
        owner,
        account.id,
        (_values(contract_id=contract.id, category_id=category.id),),
    )

    assert len(created) == 1
    assert created[0].contract_id == contract.id


def test_bulk_relationship_validation_rejects_cross_owner_contract_for_superuser(
    session: Session,
) -> None:
    superuser = add_user(session, "admin", is_superuser=True)
    owner = add_user(session, "owner")
    other_owner = add_user(session, "other")
    account = add_account(session, owner)
    contract = add_contract(session, other_owner)

    with pytest.raises(ConflictError, match="gehört nicht zum Konto"):
        create_transactions(
            session,
            superuser,
            account.id,
            (_values(contract_id=contract.id),),
        )


def test_update_rejects_new_cross_owner_contract_for_superuser(session: Session) -> None:
    superuser = add_user(session, "admin", is_superuser=True)
    owner = add_user(session, "owner")
    other_owner = add_user(session, "other")
    account = add_account(session, owner)
    contract = add_contract(session, other_owner)
    transaction = _transaction(account.id)
    session.add(transaction)
    session.flush()

    with pytest.raises(ConflictError, match="gehört nicht zum Konto"):
        update_transaction(
            session,
            superuser,
            account.id,
            transaction.id,
            _values(contract_id=contract.id),
        )


def test_assignment_review_returns_only_actionable_contract_suggestions(
    session: Session,
) -> None:
    owner = add_user(session, "owner")
    account = add_account(session, owner)
    contract = add_contract(session, owner, name="Internet")
    contract.patterns = "Provider"
    category = Category(name="Kommunikation", patterns="provider")
    suggested = _transaction(account.id)
    suggested.recipient = "Mein Provider"
    unrelated = _transaction(account.id)
    unrelated.recipient = "Supermarkt"
    session.add_all((category, suggested, unrelated))
    session.flush()

    contract_page = get_assignment_review_page(session, owner, issue=ReviewIssue.CONTRACT)
    all_page = get_assignment_review_page(session, owner)

    assert [item.transaction.id for item in contract_page.items] == [suggested.id]
    suggested_item = next(item for item in all_page.items if item.transaction.id == suggested.id)
    assert set(suggested_item.issues) == {"category", "contract"}
    assert suggested_item.category_match.status == "unique"
    assert suggested_item.contract_match.status == "unique"


def test_bulk_assignment_can_confirm_an_intentionally_empty_value(session: Session) -> None:
    owner = add_user(session, "owner")
    account = add_account(session, owner)
    transaction = _transaction(account.id)
    session.add(transaction)
    session.flush()

    updated = bulk_update_assignments(
        session,
        owner,
        (transaction.id,),
        set_category=True,
        category_id=None,
        set_contract=True,
        contract_id=None,
    )

    assert len(updated) == 1
    assert transaction.category_id is None
    assert transaction.contract_id is None
    assert transaction.category_reviewed
    assert transaction.contract_reviewed


def test_pattern_preview_is_scoped_by_owner_and_date(session: Session) -> None:
    admin = add_user(session, "admin", is_superuser=True)
    owner = add_user(session, "owner")
    other = add_user(session, "other")
    account = add_account(session, owner)
    other_account = add_account(session, other)
    matching = _transaction(account.id)
    matching.recipient = "Stadtwerke"
    matching.date_issue = date(2026, 2, 1)
    outside_owner = _transaction(other_account.id)
    outside_owner.recipient = "Stadtwerke"
    session.add_all((matching, outside_owner))
    session.flush()

    result = preview_patterns(
        session,
        admin,
        " stadtwerke ",
        owner_id=owner.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )

    assert result.total == 1
    assert result.examples[0][0].id == matching.id
