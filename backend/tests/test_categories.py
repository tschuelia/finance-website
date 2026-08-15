from app.db.models import Category
from app.services.categories import category_patterns, match_transaction_category


def test_empty_category_patterns_never_match() -> None:
    categories = (
        Category(id=1, name="Leer", patterns="\n  \n"),
        Category(id=2, name="Treffer", patterns=" Miete \n\n"),
    )

    assert category_patterns(categories[0]) == ()
    assert match_transaction_category("", "", categories) is None
    assert match_transaction_category("Vermieter", "Monatliche MIETE", categories) is categories[1]


def test_pattern_matching_checks_recipient_before_subject() -> None:
    recipient_category = Category(id=1, name="Empfänger", patterns="laden")
    subject_category = Category(id=2, name="Betreff", patterns="strom")

    assert (
        match_transaction_category(
            "Mein Laden",
            "Stromrechnung",
            (subject_category, recipient_category),
        )
        is recipient_category
    )


def test_pattern_matching_uses_unicode_case_folding() -> None:
    category = Category(id=1, name="Straße", patterns="STRASSE")
    assert match_transaction_category("Straße", "", (category,)) is category
