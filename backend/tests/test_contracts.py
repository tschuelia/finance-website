from datetime import date, timedelta
from decimal import Decimal

from conftest import add_account, add_contract, add_user
from sqlalchemy.orm import Session

from app.cli.management import update_account
from app.db.models import Transaction
from app.services.contracts import get_contract_detail, update_contract


def _transaction(
    account_id: int | None,
    contract_id: int,
    *,
    amount: str,
    issue_date: date,
) -> Transaction:
    return Transaction(
        bank_account_id=account_id,
        recipient="Empfänger",
        amount=Decimal(amount),
        subject="Betreff",
        date_issue=issue_date,
        date_booking=None,
        full_subject_string="Betreff",
        category_id=None,
        contract_id=contract_id,
    )


def test_contract_transactions_are_paginated(session: Session) -> None:
    owner = add_user(session, "owner")
    account = add_account(session, owner)
    contract = add_contract(session, owner)
    for index in range(125):
        session.add(
            _transaction(
                account.id,
                contract.id,
                amount="1.00",
                issue_date=date(2026, 1, 1) + timedelta(days=index),
            )
        )
    session.flush()

    page = get_contract_detail(session, owner, contract.id, page=2, page_size=50)
    assert page.transactions.page == 2
    assert page.transactions.page_size == 50
    assert page.transactions.total == 125
    assert page.transactions.total_pages == 3
    assert len(page.transactions.items) == 50
    assert page.financials.balance == Decimal("125")
    assert all(item.bank_account_id == account.id for item in page.transactions.items)


def test_contract_includes_transactions_from_shared_and_missing_accounts(
    session: Session,
) -> None:
    owner = add_user(session, "owner")
    other = add_user(session, "other")
    account = add_account(session, owner)
    other_account = add_account(session, other)
    contract = add_contract(session, owner)
    session.add_all(
        (
            _transaction(
                account.id,
                contract.id,
                amount="1.00",
                issue_date=date(2026, 1, 1),
            ),
            _transaction(
                other_account.id,
                contract.id,
                amount="2.00",
                issue_date=date(2026, 1, 2),
            ),
            _transaction(
                None,
                contract.id,
                amount="3.00",
                issue_date=date(2026, 1, 3),
            ),
        )
    )
    session.flush()

    detail = get_contract_detail(session, owner, contract.id)

    assert detail.transactions.total == 3
    assert [item.bank_account_id for item in detail.transactions.items] == [
        None,
        other_account.id,
        account.id,
    ]
    assert detail.financials.balance == Decimal("6")
    assert detail.financials.first_transaction_date == date(2026, 1, 1)
    assert detail.financials.last_transaction_date == date(2026, 1, 3)


def test_contract_owner_can_change_with_shared_transactions(session: Session) -> None:
    admin = add_user(session, "admin", is_superuser=True)
    owner = add_user(session, "owner")
    new_owner = add_user(session, "new-owner")
    account = add_account(session, owner)
    contract = add_contract(session, owner)
    session.add(
        _transaction(
            account.id,
            contract.id,
            amount="1.00",
            issue_date=date(2026, 1, 1),
        )
    )
    session.flush()

    updated = update_contract(
        session,
        admin,
        contract.id,
        owner_id=new_owner.id,
        name=contract.name,
        description=contract.description,
        is_active=contract.is_active,
        start_date=contract.start_date,
        end_date=contract.end_date,
    )

    assert updated.owner_id == new_owner.id


def test_account_owner_can_change_with_shared_contracts(session: Session) -> None:
    owner = add_user(session, "owner")
    new_owner = add_user(session, "new-owner")
    account = add_account(session, owner)
    contract = add_contract(session, owner)
    session.add(
        _transaction(
            account.id,
            contract.id,
            amount="1.00",
            issue_date=date(2026, 1, 1),
        )
    )
    session.flush()

    updated = update_account(
        session,
        account_id=account.id,
        name=None,
        bank=None,
        current_amount=None,
        owner=new_owner,
    )

    assert updated.owner_id == new_owner.id
