import csv
import io
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation


class CsvImportError(ValueError):
    """Raised when a bank export cannot be converted safely."""


@dataclass(frozen=True, slots=True)
class ImportedTransaction:
    recipient: str
    amount: Decimal
    subject: str
    date_issue: date
    date_booking: date | None
    full_subject_string: str


@dataclass(frozen=True, slots=True)
class BankFormat:
    encoding: str
    columns: Mapping[str, str]
    date_format: str
    german_amount: bool = True
    additional_required_columns: tuple[str, ...] = ()


FORMATS = {
    "comdirect": BankFormat(
        encoding="latin-1",
        columns={
            "Buchungstag": "date_issue",
            "Wertstellung (Valuta)": "date_booking",
            "Vorgang": "event",
            "Buchungstext": "subject",
            "Umsatz in EUR": "amount",
        },
        date_format="%d.%m.%Y",
    ),
    "dkb": BankFormat(
        encoding="utf-8-sig",
        columns={
            "Buchungsdatum": "date_issue",
            "Wertstellung": "date_booking",
            "Umsatztyp": "event",
            "Verwendungszweck": "subject",
            "Betrag (€)": "amount",
        },
        date_format="%d.%m.%y",
        additional_required_columns=("Zahlungspflichtige*r", "Zahlungsempfänger*in"),
    ),
    "holvi": BankFormat(
        encoding="utf-8-sig",
        columns={
            "Zahlungsdatum": "date_issue",
            "Buchungsdatum": "date_booking",
            "Gegenpartei": "recipient",
            "Betrag": "amount",
            "Referenz": "subject",
        },
        date_format="%d.%m.%Y",
    ),
    "n26": BankFormat(
        encoding="utf-8-sig",
        columns={
            "Booking Date": "date_issue",
            "Value Date": "date_booking",
            "Partner Name": "recipient",
            "Payment Reference": "subject",
            "Amount (EUR)": "amount",
        },
        date_format="%Y-%m-%d",
        german_amount=False,
    ),
}


def _decode(data: bytes, encoding: str) -> str:
    try:
        return data.decode(encoding)
    except UnicodeDecodeError:
        raise CsvImportError("Die Zeichenkodierung der CSV-Datei wird nicht unterstützt.") from None


def _content_from_header(content: str, header: str, *, footer: str | None = None) -> str:
    header_index = content.find(header)
    if header_index < 0:
        raise CsvImportError(f"Die erforderliche Kopfzeile „{header}“ fehlt.")
    # Exports may quote their headers. Keep the complete header line rather
    # than starting at the text inside the first quoted field.
    content = content[content.rfind("\n", 0, header_index) + 1 :]
    if footer is not None:
        footer_index = content.find(footer)
        if footer_index >= 0:
            content = content[:footer_index]
    return content


def _parse_date(value: str, date_format: str, *, column: str) -> date:
    try:
        return datetime.strptime(value.strip(), date_format).date()
    except ValueError:
        raise CsvImportError(f"Ungültiges Datum in der Spalte „{column}“: {value}") from None


def _parse_optional_date(value: str, date_format: str, *, column: str) -> date | None:
    if not value.strip():
        return None
    return _parse_date(value, date_format, column=column)


def _parse_amount(value: str, *, german: bool) -> Decimal:
    normalized = value.strip().replace("\u00a0", "").replace(" ", "")
    if german:
        normalized = normalized.replace(".", "").replace(",", ".")
    try:
        amount = Decimal(normalized)
    except InvalidOperation:
        raise CsvImportError(f"Ungültiger Betrag: {value}") from None
    exponent = amount.as_tuple().exponent
    if (
        not amount.is_finite()
        or not isinstance(exponent, int)
        or exponent < -2
        or abs(amount) > Decimal("99999999.99")
    ):
        raise CsvImportError(f"Ungültiger Betrag: {value}")
    return amount.quantize(Decimal("0.01"))


def _normalized_rows(content: str, bank_format: BankFormat) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(content), delimiter=";")
    fieldnames = set(reader.fieldnames or ())
    required_columns = (*bank_format.columns, *bank_format.additional_required_columns)
    missing = [column for column in required_columns if column not in fieldnames]
    if missing:
        raise CsvImportError(f"Erforderliche CSV-Spalten fehlen: {', '.join(missing)}")

    rows: list[dict[str, str]] = []
    for source_row in reader:
        if not source_row or all(not (value or "").strip() for value in source_row.values()):
            continue
        rows.append(
            {
                target: (source_row.get(source) or "").strip()
                for source, target in bank_format.columns.items()
            }
            | {key: (value or "").strip() for key, value in source_row.items() if key is not None}
        )
    return rows


def _base_transaction(row: Mapping[str, str], bank_format: BankFormat) -> ImportedTransaction:
    subject = row.get("subject", "")
    return ImportedTransaction(
        recipient=row.get("recipient", ""),
        amount=_parse_amount(row.get("amount", ""), german=bank_format.german_amount),
        subject=subject,
        date_issue=_parse_date(
            row.get("date_issue", ""), bank_format.date_format, column="Buchungstag"
        ),
        date_booking=_parse_optional_date(
            row.get("date_booking", ""), bank_format.date_format, column="Wertstellungstag"
        ),
        full_subject_string=subject,
    )


def _comdirect(row: Mapping[str, str], bank_format: BankFormat) -> ImportedTransaction | None:
    if (
        row.get("date_booking", "").casefold() == "offen"
        or row.get("date_issue", "").casefold() == "offen"
    ):
        return None
    transaction = _base_transaction(row, bank_format)
    subject = transaction.subject.casefold()
    for marker in ("ref.", "kfn", "karte"):
        if marker in subject:
            subject = subject.split(marker, maxsplit=1)[0]

    event = row.get("event", "")
    recipient = ""
    if event == "Entgelte":
        recipient, subject = "Bank Entgelt", subject
    elif event == "Rücklastschrift":
        recipient, subject = "Rücklastschrift", subject
    elif event == "Bar":
        recipient, subject = "Bank Einzahlung Bar", "Bargeldeinzahlung"
    elif event == "Kontoführungsentgelt" and "visa" in subject:
        recipient, subject = "Bank Entgelt", "Kontoführungsentgelt Visa Card"
    elif "auftraggeber:" in subject and "buchungstext:" in subject:
        recipient_part, subject = subject.split("buchungstext:", maxsplit=1)
        recipient = recipient_part.split("auftraggeber:", maxsplit=1)[1].strip()
        subject = subject.strip()
    elif "empfänger:" in subject and "buchungstext:" in subject:
        recipient_part, subject = subject.split("buchungstext:", maxsplit=1)
        recipient = recipient_part.split("empfänger:", maxsplit=1)[1].strip()
        subject = subject.strip()
    return ImportedTransaction(
        recipient=recipient,
        amount=transaction.amount,
        subject=subject,
        date_issue=transaction.date_issue,
        date_booking=transaction.date_booking,
        full_subject_string=transaction.full_subject_string,
    )


def _dkb(row: Mapping[str, str], bank_format: BankFormat) -> ImportedTransaction:
    transaction = _base_transaction(row, bank_format)
    recipient_column = "Zahlungspflichtige*r" if transaction.amount >= 0 else "Zahlungsempfänger*in"
    return ImportedTransaction(
        recipient=row.get(recipient_column, "") or "DKB AG",
        amount=transaction.amount,
        subject=transaction.subject,
        date_issue=transaction.date_issue,
        date_booking=transaction.date_booking,
        full_subject_string=transaction.full_subject_string,
    )


def _holvi(row: Mapping[str, str], bank_format: BankFormat) -> ImportedTransaction:
    transaction = _base_transaction(row, bank_format)
    subject = transaction.subject or row.get("Nachricht", "")
    return ImportedTransaction(
        recipient=transaction.recipient,
        amount=transaction.amount,
        subject=subject,
        date_issue=transaction.date_issue,
        date_booking=transaction.date_booking,
        full_subject_string=subject,
    )


def _n26(row: Mapping[str, str], bank_format: BankFormat) -> ImportedTransaction:
    transaction = _base_transaction(row, bank_format)
    subject = transaction.subject or transaction.recipient
    return ImportedTransaction(
        recipient=transaction.recipient,
        amount=transaction.amount,
        subject=subject,
        date_issue=transaction.date_issue,
        date_booking=transaction.date_booking,
        full_subject_string=subject,
    )


def parse_bank_csv(bank: str, data: bytes) -> tuple[ImportedTransaction, ...]:
    normalized_bank = bank.strip().casefold()
    bank_format = FORMATS.get(normalized_bank)
    if bank_format is None:
        raise CsvImportError(
            "Es werden nur CSV-Exporte von Comdirect, DKB, Holvi und N26 unterstützt."
        )
    content = _decode(data, bank_format.encoding)
    header = next(iter(bank_format.columns))
    content = _content_from_header(
        content,
        header,
        footer="Umsätze Visa-Karte" if normalized_bank == "comdirect" else None,
    )
    rows = _normalized_rows(content, bank_format)
    converters: dict[
        str,
        Callable[[Mapping[str, str], BankFormat], ImportedTransaction | None],
    ] = {
        "comdirect": _comdirect,
        "dkb": _dkb,
        "holvi": _holvi,
        "n26": _n26,
    }
    transactions = tuple(
        transaction
        for row in rows
        if (transaction := converters[normalized_bank](row, bank_format)) is not None
    )
    if not transactions:
        raise CsvImportError("Die CSV-Datei enthält keine importierbaren Transaktionen.")
    return transactions
