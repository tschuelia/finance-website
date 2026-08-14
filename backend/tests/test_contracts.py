from datetime import date, timedelta
from decimal import Decimal

from conftest import add_account, add_contract, add_user
from sqlalchemy.orm import Session

from app.db.models import Transaction
from app.services.contracts import get_contract_detail


def test_contract_transactions_are_paginated_and_owner_scoped(session: Session) -> None:
    owner = add_user(session, "owner")
    other = add_user(session, "other")
    account = add_account(session, owner)
    other_account = add_account(session, other)
    contract = add_contract(session, owner)
    for index in range(125):
        session.add(
            Transaction(
                bank_account_id=account.id,
                recipient=f"Empfänger {index}",
                amount=Decimal("1.00"),
                subject="Betreff",
                date_issue=date(2026, 1, 1) + timedelta(days=index),
                date_booking=None,
                full_subject_string="Betreff",
                category_id=None,
                contract_id=contract.id,
            )
        )
    # This inconsistent legacy-style row must never leak through contract detail.
    session.add(
        Transaction(
            bank_account_id=other_account.id,
            recipient="Fremd",
            amount=Decimal("999.00"),
            subject="Fremd",
            date_issue=date(2026, 8, 1),
            date_booking=None,
            full_subject_string="Fremd",
            category_id=None,
            contract_id=contract.id,
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
