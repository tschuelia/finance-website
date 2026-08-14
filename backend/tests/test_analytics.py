from datetime import date
from decimal import Decimal

from conftest import add_account, add_user
from sqlalchemy.orm import Session

from app.db.models import Category, Transaction
from app.services.analytics import category_comparisons, category_totals, monthly_totals
from app.services.transactions import TransactionFilters


def _add_transaction(
    session: Session,
    account_id: int,
    *,
    amount: str,
    issue_date: date,
    category: Category | None,
) -> None:
    session.add(
        Transaction(
            bank_account_id=account_id,
            recipient="Empfänger",
            amount=Decimal(amount),
            subject="Betreff",
            date_issue=issue_date,
            date_booking=None,
            full_subject_string="Betreff",
            category_id=category.id if category is not None else None,
            contract_id=None,
        )
    )


def test_sql_analytics_preserve_expected_financial_results(session: Session) -> None:
    user = add_user(session, "owner")
    account = add_account(session, user)
    income = Category(name="Einkommen", patterns="")
    food = Category(name="Lebensmittel", patterns="")
    session.add_all((income, food))
    session.flush()
    _add_transaction(
        session,
        account.id,
        amount="100.00",
        issue_date=date(2026, 1, 5),
        category=income,
    )
    _add_transaction(
        session,
        account.id,
        amount="-20.00",
        issue_date=date(2026, 1, 10),
        category=food,
    )
    _add_transaction(
        session,
        account.id,
        amount="-30.00",
        issue_date=date(2026, 2, 10),
        category=food,
    )
    _add_transaction(
        session,
        account.id,
        amount="50.00",
        issue_date=date(2026, 3, 10),
        category=None,
    )
    session.flush()

    filters = TransactionFilters(
        date_start=date(2026, 1, 1),
        date_end=date(2026, 3, 31),
    )
    totals = category_totals(session, user, account.id, filters)
    assert [(item.category, item.income, item.expense) for item in totals] == [
        ("Lebensmittel", Decimal("0"), Decimal("50")),
        ("Einkommen", Decimal("100"), Decimal("0")),
        ("ohne Kategorie", Decimal("50"), Decimal("0")),
    ]

    comparisons = category_comparisons(
        session,
        user,
        account.id,
        filters,
        ("2026-01", "2026-02", "2026-03"),
    )
    assert [item.period for item in comparisons] == ["2026-01", "2026-02", "2026-03"]
    assert comparisons[0].totals[0].expense == Decimal("20")
    assert comparisons[0].totals[1].income == Decimal("100")
    assert comparisons[1].totals[0].expense == Decimal("30")
    assert comparisons[2].totals[0].income == Decimal("50")

    monthly = monthly_totals(
        session,
        user,
        account.id,
        filters,
        3,
        today=date(2026, 3, 15),
    )
    assert [(item.period, item.income, item.expense) for item in monthly] == [
        ("2026-01", Decimal("100"), Decimal("20")),
        ("2026-02", Decimal("0"), Decimal("30")),
        ("2026-03", Decimal("50"), Decimal("0")),
    ]
