from datetime import date, timedelta
from decimal import Decimal

from conftest import add_account, add_contract, add_user
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.cli.management import update_account
from app.config import Settings
from app.db.models import Contract, Transaction
from app.services.contracts import (
    delete_contract,
    get_contract_detail,
    match_transaction_contracts,
    update_contract,
)


def _login(client: TestClient, username: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "test-password"},
    )
    assert response.status_code == 200
    return str(response.json()["csrf_token"])


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


def test_delete_contract_unlinks_and_reviews_all_linked_transactions(
    session: Session,
    settings: Settings,
) -> None:
    owner = add_user(session, "owner")
    other = add_user(session, "other")
    account = add_account(session, owner)
    other_account = add_account(session, other)
    contract = add_contract(session, owner)
    unrelated_contract = add_contract(session, owner, name="Unrelated")
    linked = (
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
    unrelated = _transaction(
        account.id,
        unrelated_contract.id,
        amount="4.00",
        issue_date=date(2026, 1, 4),
    )
    session.add_all((*linked, unrelated))
    session.flush()

    delete_contract(session, owner, contract.id, settings.media_root)

    assert session.get(Contract, contract.id) is None
    assert all(transaction.contract_id is None for transaction in linked)
    assert all(transaction.contract_reviewed for transaction in linked)
    assert unrelated.contract_id == unrelated_contract.id
    assert not unrelated.contract_reviewed


def test_contract_delete_endpoint_requires_csrf(
    app_client: TestClient,
    session: Session,
) -> None:
    owner = add_user(session, "owner")
    contract = add_contract(session, owner)
    contract_id = contract.id
    session.commit()
    _login(app_client, owner.username)

    response = app_client.delete(f"/api/v1/contracts/{contract_id}")

    assert response.status_code == 403
    session.expire_all()
    assert session.get(Contract, contract_id) is not None


def test_contract_delete_endpoint_enforces_visibility_and_deletes(
    app_client: TestClient,
    session: Session,
) -> None:
    owner = add_user(session, "owner")
    other = add_user(session, "other")
    contract = add_contract(session, owner)
    other_contract = add_contract(session, other)
    contract_id = contract.id
    other_contract_id = other_contract.id
    session.commit()
    csrf_token = _login(app_client, owner.username)
    headers = {"X-CSRF-Token": csrf_token}

    forbidden = app_client.delete(
        f"/api/v1/contracts/{other_contract_id}",
        headers=headers,
    )
    missing = app_client.delete("/api/v1/contracts/999999", headers=headers)
    deleted = app_client.delete(f"/api/v1/contracts/{contract_id}", headers=headers)

    assert forbidden.status_code == 403
    assert missing.status_code == 404
    assert deleted.status_code == 204
    session.expire_all()
    assert session.get(Contract, contract_id) is None
    assert session.get(Contract, other_contract_id) is not None


def test_contract_matching_uses_terms_and_contract_period(session: Session) -> None:
    owner = add_user(session, "owner")
    matching = add_contract(session, owner, name="Strom")
    matching.patterns = " Stadtwerke \n"
    expired = add_contract(session, owner, name="Altvertrag")
    expired.patterns = "Stadtwerke"
    expired.end_date = date(2025, 12, 31)
    session.flush()

    result = match_transaction_contracts(
        "Stadtwerke Berlin",
        "Abschlag",
        date(2026, 1, 1),
        (expired, matching),
    )

    assert result.status == "unique"
    assert result.candidates[0].id == matching.id
    assert result.candidates[0].matched_patterns == ("Stadtwerke",)
