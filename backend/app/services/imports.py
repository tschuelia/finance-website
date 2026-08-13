from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Category, User
from app.imports import ImportedTransaction, parse_bank_csv
from app.services.access import get_visible_bank_account
from app.services.categories import match_transaction_category


@dataclass(frozen=True, slots=True)
class ImportPreviewRow:
    transaction: ImportedTransaction
    category_id: int | None


def preview_csv_import(
    session: Session,
    current_user: User,
    account_id: int,
    data: bytes,
) -> tuple[ImportPreviewRow, ...]:
    account = get_visible_bank_account(session, current_user, account_id)
    transactions = parse_bank_csv(account.bank, data)
    categories = tuple(session.scalars(select(Category).order_by(Category.id)))
    return tuple(
        ImportPreviewRow(
            transaction=transaction,
            category_id=(
                category.id
                if (
                    category := match_transaction_category(
                        transaction.recipient,
                        transaction.subject,
                        categories,
                    )
                )
                is not None
                else None
            ),
        )
        for transaction in transactions
    )
