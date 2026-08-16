from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Category, Contract, User
from app.imports import ImportedTransaction, SkippedCsvRow, parse_bank_csv_report
from app.services.access import get_visible_bank_account
from app.services.categories import match_transaction_categories
from app.services.contracts import match_transaction_contracts
from app.services.matching import MatchStatus, RuleMatch


@dataclass(frozen=True, slots=True)
class ImportPreviewRow:
    transaction: ImportedTransaction
    category_id: int | None
    contract_id: int | None
    category_match: RuleMatch
    contract_match: RuleMatch


@dataclass(frozen=True, slots=True)
class ImportPreview:
    rows: tuple[ImportPreviewRow, ...]
    skipped_rows: tuple[SkippedCsvRow, ...]


def preview_csv_import(
    session: Session,
    current_user: User,
    account_id: int,
    data: bytes,
) -> ImportPreview:
    account = get_visible_bank_account(session, current_user, account_id)
    report = parse_bank_csv_report(account.bank, data)
    categories = tuple(session.scalars(select(Category).order_by(Category.id)))
    contracts = tuple(
        session.scalars(
            select(Contract)
            .where(Contract.owner_id == account.owner_id)
            .order_by(Contract.name, Contract.id)
        )
    )
    rows: list[ImportPreviewRow] = []
    for transaction in report.transactions:
        category_match = match_transaction_categories(
            transaction.recipient,
            transaction.subject,
            categories,
        )
        contract_match = match_transaction_contracts(
            transaction.recipient,
            transaction.subject,
            transaction.date_issue,
            contracts,
        )
        rows.append(
            ImportPreviewRow(
                transaction=transaction,
                category_id=(
                    category_match.candidates[0].id
                    if category_match.status is MatchStatus.UNIQUE
                    else None
                ),
                contract_id=(
                    contract_match.candidates[0].id
                    if contract_match.status is MatchStatus.UNIQUE
                    else None
                ),
                category_match=category_match,
                contract_match=contract_match,
            )
        )
    return ImportPreview(rows=tuple(rows), skipped_rows=report.skipped_rows)
