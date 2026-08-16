from datetime import date
from decimal import Decimal

from conftest import add_account, add_contract, add_user
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import (
    BankDepot,
    Category,
    DepotAsset,
    DepotBalanceSnapshot,
    InternalTransferReview,
    Transaction,
)
from app.schemas.dashboard import CashFlowDashboardResponse
from app.services.dashboard import get_cash_flow_dashboard, get_wealth_dashboard


def _transaction(
    session: Session,
    account_id: int,
    amount: str,
    issue_date: date,
    *,
    contract_id: int | None = None,
) -> Transaction:
    transaction = Transaction(
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
    session.add(transaction)
    session.flush()
    return transaction


def test_contract_expenses_include_status_and_monthly_history(session: Session) -> None:
    user = add_user(session, "owner")
    account = add_account(session, user)
    unselected_account = add_account(session, user, name="Nicht ausgewählt")
    active = add_contract(session, user, name="Streaming")
    inactive = add_contract(session, user, name="Alter Vertrag")
    inactive.is_active = False
    _transaction(
        session,
        account.id,
        "-100.00",
        date(2026, 1, 5),
        contract_id=active.id,
    )
    _transaction(
        session,
        unselected_account.id,
        "-900.00",
        date(2026, 2, 25),
        contract_id=active.id,
    )
    _transaction(
        session,
        account.id,
        "-100.00",
        date(2026, 2, 5),
        contract_id=active.id,
    )
    _transaction(
        session,
        account.id,
        "-300.00",
        date(2026, 2, 10),
        contract_id=inactive.id,
    )
    _transaction(session, account.id, "-500.00", date(2026, 2, 15))
    _transaction(
        session,
        account.id,
        "50.00",
        date(2026, 2, 20),
        contract_id=active.id,
    )

    dashboard = get_cash_flow_dashboard(
        session,
        user,
        (account.id,),
        start_month="2026-01",
        end_month="2026-03",
        today=date(2026, 4, 15),
    )

    assert [item.contract_name for item in dashboard.contracts] == [
        "Alter Vertrag",
        "Streaming",
    ]
    assert [item.is_active for item in dashboard.contracts] == [False, True]
    assert [item.expense for item in dashboard.contracts] == [
        Decimal("300"),
        Decimal("200"),
    ]
    assert dashboard.contracts[0].monthly_average == Decimal("100")
    assert dashboard.contracts[1].monthly_average == Decimal("200") / Decimal("3")
    assert [
        (item.period, item.contract_id, item.expense) for item in dashboard.contract_monthly
    ] == [
        ("2026-01", active.id, Decimal("100")),
        ("2026-02", active.id, Decimal("100")),
        ("2026-02", inactive.id, Decimal("300")),
    ]
    assert dashboard.contract_expense_share == Decimal("0.5")
    response = CashFlowDashboardResponse.model_validate(dashboard).model_dump(mode="json")
    assert response["contracts"][0]["is_active"] is False
    assert response["contract_monthly"][0] == {
        "period": "2026-01",
        "contract_id": active.id,
        "expense": 100.0,
    }


def test_combined_cash_flow_excludes_only_confirmed_transfers(session: Session) -> None:
    user = add_user(session, "owner")
    first = add_account(session, user, name="Giro")
    second = add_account(session, user, name="Tagesgeld")
    contract = add_contract(session, user)
    _transaction(session, first.id, "1000.00", date(2026, 1, 3))
    _transaction(
        session,
        first.id,
        "-200.00",
        date(2026, 1, 5),
        contract_id=contract.id,
    )
    outgoing = _transaction(
        session,
        first.id,
        "-300.00",
        date(2026, 1, 8),
        contract_id=contract.id,
    )
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
    assert dashboard.contracts[0].expense == Decimal("200")


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
            ("account_ids", str(first.id)),
            ("account_ids", str(second.id)),
            ("start_month", "2026-01"),
            ("end_month", "2026-01"),
        ],
    )
    assert wealth.status_code == 200
    assert wealth.json()["current_total"] == 100.0


def test_spending_anomaly_uses_only_available_history_months(session: Session) -> None:
    user = add_user(session, "owner")
    account = add_account(session, user)
    category = Category(name="Lebensmittel", patterns="")
    session.add(category)
    session.flush()
    for issue_date, amount in (
        (date(2025, 12, 5), "-100.00"),
        (date(2026, 1, 5), "-100.00"),
        (date(2026, 2, 5), "-100.00"),
        (date(2026, 3, 5), "-200.00"),
    ):
        transaction = _transaction(session, account.id, amount, issue_date)
        transaction.category_id = category.id
    session.flush()

    dashboard = get_cash_flow_dashboard(
        session,
        user,
        (account.id,),
        start_month="2026-03",
        end_month="2026-03",
        today=date(2026, 4, 15),
    )

    assert len(dashboard.anomalies) == 1
    assert dashboard.anomalies[0].baseline_median == Decimal("100")


def test_wealth_api_rejects_legacy_encoded_sources(
    app_client: TestClient,
    session: Session,
) -> None:
    user = add_user(session, "owner")
    account = add_account(session, user)
    session.commit()
    login = app_client.post(
        "/api/v1/auth/login",
        json={"username": user.username, "password": "test-password"},
    )
    assert login.status_code == 200

    response = app_client.get(
        "/api/v1/analytics/wealth",
        params={"sources": f"account:{account.id}"},
    )

    assert response.status_code == 422
