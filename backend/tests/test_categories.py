from datetime import date
from decimal import Decimal

from conftest import add_account, add_user
from sqlalchemy.orm import Session

from app.db.models import Category, Transaction
from app.services.categories import (
    category_patterns,
    match_transaction_categories,
    match_transaction_category,
    update_category,
)


def test_empty_category_patterns_never_match() -> None:
    categories = (
        Category(id=1, name="Leer", patterns="\n  \n"),
        Category(id=2, name="Treffer", patterns=" Miete \n\n"),
    )

    assert category_patterns(categories[0]) == ()
    assert match_transaction_category("", "", categories) is None
    assert match_transaction_category("Vermieter", "Monatliche MIETE", categories) is categories[1]


def test_pattern_matching_marks_cross_field_overlap_as_ambiguous() -> None:
    recipient_category = Category(id=1, name="Empfänger", patterns="laden")
    subject_category = Category(id=2, name="Betreff", patterns="strom")

    match = match_transaction_categories(
        "Mein Laden",
        "Stromrechnung",
        (subject_category, recipient_category),
    )

    assert match.status == "ambiguous"
    assert {candidate.id for candidate in match.candidates} == {1, 2}
    assert (
        match_transaction_category(
            "Mein Laden",
            "Stromrechnung",
            (subject_category, recipient_category),
        )
        is None
    )


def test_pattern_matching_uses_unicode_case_folding() -> None:
    category = Category(id=1, name="Straße", patterns="STRASSE")
    assert match_transaction_category("Straße", "", (category,)) is category


def test_category_pattern_change_invalidates_only_affected_reviews(session: Session) -> None:
    owner = add_user(session, "owner")
    account = add_account(session, owner)
    category = Category(name="Wohnen", patterns="miete")
    session.add(category)
    session.flush()

    def reviewed_transaction(recipient: str) -> Transaction:
        transaction = Transaction(
            bank_account_id=account.id,
            recipient=recipient,
            amount=Decimal("-10.00"),
            subject="Betreff",
            date_issue=date(2026, 1, 1),
            date_booking=None,
            full_subject_string="Betreff",
            category_id=None,
            contract_id=None,
            category_reviewed=True,
        )
        session.add(transaction)
        return transaction

    old_match = reviewed_transaction("Miete")
    new_match = reviewed_transaction("Supermarkt")
    unrelated = reviewed_transaction("Kino")
    session.flush()

    update_category(
        session,
        category.id,
        name="Haushalt",
        patterns="supermarkt",
    )

    session.refresh(old_match)
    session.refresh(new_match)
    session.refresh(unrelated)
    assert not old_match.category_reviewed
    assert not new_match.category_reviewed
    assert unrelated.category_reviewed


def test_category_metadata_change_preserves_reviews(session: Session) -> None:
    owner = add_user(session, "owner")
    account = add_account(session, owner)
    category = Category(name="Wohnen", patterns="miete")
    transaction = Transaction(
        bank_account_id=account.id,
        recipient="Miete",
        amount=Decimal("-10.00"),
        subject="Betreff",
        date_issue=date(2026, 1, 1),
        date_booking=None,
        full_subject_string="Betreff",
        category_id=None,
        contract_id=None,
        category_reviewed=True,
    )
    session.add_all((category, transaction))
    session.flush()

    update_category(session, category.id, name="Neuer Name", patterns="miete")

    session.refresh(transaction)
    assert transaction.category_reviewed
