from datetime import date
from decimal import Decimal

from conftest import add_account, add_user
from sqlalchemy.orm import Session

from app.db.models import Transaction
from app.services.accounts import get_account_financials, get_portfolio_overview
from app.services.transactions import TransactionFilters, TransactionType, get_transaction_page


def _transaction(account_id: int, amount: str) -> Transaction:
    return Transaction(
        bank_account_id=account_id,
        recipient="Empfänger",
        amount=Decimal(amount),
        subject="Betreff",
        date_issue=date(2026, 8, 1),
        date_booking=None,
        full_subject_string="Betreff",
        category_id=None,
        contract_id=None,
    )


def test_account_and_portfolio_balances_include_starting_amount(session: Session) -> None:
    user = add_user(session, "owner")
    account = add_account(session, user, name="Girokonto")
    account.current_amount = Decimal("125.50")
    account_without_transactions = add_account(session, user, name="Sparkonto")
    account_without_transactions.current_amount = Decimal("20.00")
    session.add_all(
        (
            _transaction(account.id, "50.00"),
            _transaction(account.id, "-15.00"),
        )
    )
    session.flush()

    account_financials = get_account_financials(
        session,
        user,
        account.id,
        today=date(2026, 8, 15),
    )
    empty_account_financials = get_account_financials(
        session,
        user,
        account_without_transactions.id,
        today=date(2026, 8, 15),
    )
    portfolio = get_portfolio_overview(session, user, today=date(2026, 8, 15))
    incoming_transactions = get_transaction_page(
        session,
        user,
        account.id,
        TransactionFilters(transaction_type=TransactionType.INCOME),
        today=date(2026, 8, 15),
    )

    assert account_financials.balance == Decimal("160.50")
    assert empty_account_financials.balance == Decimal("20.00")
    assert [item.financials.balance for item in portfolio.groups[0].accounts] == [
        Decimal("160.50"),
        Decimal("20.00"),
    ]
    assert portfolio.groups[0].balance == Decimal("180.50")
    assert portfolio.total_balance == Decimal("180.50")
    assert incoming_transactions.total == 1
    assert incoming_transactions.summary.received == Decimal("50.00")
    assert incoming_transactions.summary.paid == Decimal("0.00")
