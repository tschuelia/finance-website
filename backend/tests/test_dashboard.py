from datetime import date
from decimal import Decimal

from conftest import add_account, add_user
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import (
    BankDepot,
    DepotAsset,
    DepotBalanceSnapshot,
    InternalTransferReview,
    Transaction,
)
from app.services.dashboard import get_cash_flow_dashboard, get_wealth_dashboard


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


def test_combined_cash_flow_excludes_only_confirmed_transfers(session: Session) -> None:
    user = add_user(session, "owner")
    first = add_account(session, user, name="Giro")
    second = add_account(session, user, name="Tagesgeld")
    _transaction(session, first.id, "1000.00", date(2026, 1, 3))
    _transaction(session, first.id, "-200.00", date(2026, 1, 5))
    outgoing = _transaction(session, first.id, "-300.00", date(2026, 1, 8))
    incoming = _transaction(session, second.id, "300.00", date(2026, 1, 9))
    session.add(
        InternalTransferReview(
            outgoing_transaction_id=outgoing.id,
            incoming_transaction_id=incoming.id,
            status="confirmed",
            reviewed_by_id=user.id,
            reviewed_at=date(2026, 1, 10),
        )
    )
    session.flush()

    dashboard = get_cash_flow_dashboard(
        session,
        user,
        (first.id, second.id),
        start_month="2026-01",
        end_month="2026-01",
        today=date(2026, 2, 15),
    )

    assert dashboard.summary.income.value == Decimal("1000")
    assert dashboard.summary.expense.value == Decimal("200")
    assert dashboard.summary.net.value == Decimal("800")
    assert dashboard.excluded_transfer_count == 2
    assert [item.net for item in dashboard.accounts] == [Decimal("800"), Decimal("0")]


def test_wealth_history_marks_carried_depot_snapshot_as_estimated(session: Session) -> None:
    user = add_user(session, "owner")
    account = add_account(session, user)
    account.current_amount = Decimal("100.00")
    _transaction(session, account.id, "50.00", date(2026, 1, 10))
    depot = BankDepot(name="Depot", owner_id=user.id)
    session.add(depot)
    session.flush()
    session.add(
        DepotAsset(
            name="ETF",
            current_balance=Decimal("250.00"),
            bank_depot_id=depot.id,
            last_update=date(2026, 1, 31),
        )
    )
    session.add(
        DepotBalanceSnapshot(
            bank_depot_id=depot.id,
            date=date(2026, 1, 31),
            balance=Decimal("200.00"),
            is_estimated=False,
        )
    )
    session.flush()

    dashboard = get_wealth_dashboard(
        session,
        user,
        (account.id,),
        (depot.id,),
        start_month="2026-01",
        end_month="2026-02",
        today=date(2026, 3, 15),
    )

    assert dashboard.current_total == Decimal("400")
    assert dashboard.monthly[0].total == Decimal("350")
    assert dashboard.monthly[0].estimated is False
    assert dashboard.monthly[1].total == Decimal("350")
    assert dashboard.monthly[1].estimated is True


def test_combined_dashboard_api_accepts_repeated_sources(
    app_client: TestClient,
    session: Session,
) -> None:
    user = add_user(session, "owner")
    first = add_account(session, user, name="Giro")
    second = add_account(session, user, name="Sparen")
    _transaction(session, first.id, "100.00", date(2026, 1, 10))
    session.commit()
    login = app_client.post(
        "/api/v1/auth/login",
        json={"username": user.username, "password": "test-password"},
    )
    assert login.status_code == 200

    cash_flow = app_client.get(
        "/api/v1/analytics/cash-flow",
        params=[
            ("account_ids", str(first.id)),
            ("account_ids", str(second.id)),
            ("start_month", "2026-01"),
            ("end_month", "2026-01"),
        ],
    )
    assert cash_flow.status_code == 200
    assert cash_flow.json()["summary"]["income"]["value"] == 100.0

    wealth = app_client.get(
        "/api/v1/analytics/wealth",
        params=[
            ("sources", f"account:{first.id}"),
            ("sources", f"account:{second.id}"),
            ("start_month", "2026-01"),
            ("end_month", "2026-01"),
        ],
    )
    assert wealth.status_code == 200
    assert wealth.json()["current_total"] == 100.0
