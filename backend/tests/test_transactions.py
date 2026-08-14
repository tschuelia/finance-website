from datetime import date
from decimal import Decimal

import pytest
from conftest import add_account, add_contract, add_user
from sqlalchemy.orm import Session

from app.db.models import Category, Transaction
from app.errors import ConflictError
from app.services.transactions import (
    TransactionFilters,
    TransactionType,
    TransactionValues,
    create_transactions,
    get_transaction_page,
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


def test_bulk_relationship_validation_rejects_cross_owner_contract(session: Session) -> None:
    owner = add_user(session, "owner")
    other_owner = add_user(session, "other")
    account = add_account(session, owner)
    contract = add_contract(session, other_owner)

    with pytest.raises(ConflictError, match="derselben Person"):
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


def test_update_rejects_cross_owner_contract_even_for_superuser(session: Session) -> None:
    superuser = add_user(session, "admin", is_superuser=True)
    owner = add_user(session, "owner")
    other_owner = add_user(session, "other")
    account = add_account(session, owner)
    contract = add_contract(session, other_owner)
    transaction = _transaction(account.id)
    session.add(transaction)
    session.flush()

    with pytest.raises(ConflictError, match="derselben Person"):
        update_transaction(
            session,
            superuser,
            account.id,
            transaction.id,
            _values(contract_id=contract.id),
        )
