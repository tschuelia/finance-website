from app.db.models import Category
from app.services.categories import (
    category_patterns,
    match_transaction_categories,
    match_transaction_category,
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
