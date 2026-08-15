import pytest

from app.imports import CsvImportError, parse_bank_csv, parse_bank_csv_report

N26_HEADER = "Booking Date;Value Date;Partner Name;Payment Reference;Amount (EUR)"


def _n26_row(index: int) -> str:
    return f"2026-08-14;2026-08-14;Empfänger {index};Betreff;1.00"


def test_csv_parser_accepts_exact_row_limit() -> None:
    content = "\n".join((N26_HEADER, *(_n26_row(index) for index in range(500))))
    assert len(parse_bank_csv("n26", content.encode())) == 500


def test_csv_parser_rejects_row_over_limit_without_parsing_remainder() -> None:
    content = "\n".join((N26_HEADER, *(_n26_row(index) for index in range(501)), "malformed"))
    with pytest.raises(CsvImportError, match="höchstens 500"):
        parse_bank_csv("n26", content.encode())


def test_csv_parser_rejects_missing_columns_and_malformed_amount() -> None:
    with pytest.raises(CsvImportError, match="Spalten fehlen"):
        parse_bank_csv("n26", b"Booking Date;Amount (EUR)\n2026-08-14;1.00")

    content = f"{N26_HEADER}\n2026-08-14;2026-08-14;Empfänger;Betreff;kein-betrag"
    with pytest.raises(CsvImportError, match="Ungültiger Betrag"):
        parse_bank_csv("n26", content.encode())


def test_csv_preview_keeps_valid_rows_and_reports_malformed_source_row() -> None:
    content = "\n".join(
        (
            N26_HEADER,
            "2026-08-14;2026-08-14;Gültig;Betreff;1.00",
            "2026-08-14;2026-08-14;Ungültig;Betreff;kein-betrag",
        )
    )

    report = parse_bank_csv_report("n26", content.encode())

    assert [item.source_row for item in report.transactions] == [2]
    assert len(report.skipped_rows) == 1
    assert report.skipped_rows[0].source_row == 3
    assert "Ungültiger Betrag" in report.skipped_rows[0].reason
