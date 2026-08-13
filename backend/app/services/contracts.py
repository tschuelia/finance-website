from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Transaction, User
from app.services.access import get_visible_contract

ZERO = Decimal("0")


@dataclass(frozen=True, slots=True)
class ContractFinancials:
    balance: Decimal
    first_transaction: Transaction | None
    last_transaction: Transaction | None


def _decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def get_contract_financials(
    session: Session,
    current_user: User,
    contract_id: int,
) -> ContractFinancials:
    contract = get_visible_contract(session, current_user, contract_id)
    balance = session.scalar(
        select(func.sum(Transaction.amount)).where(Transaction.contract_id == contract.id)
    )
    first_transaction = session.scalar(
        select(Transaction)
        .where(Transaction.contract_id == contract.id)
        .order_by(Transaction.date_issue, Transaction.id.desc())
        .limit(1)
    )
    last_transaction = session.scalar(
        select(Transaction)
        .where(Transaction.contract_id == contract.id)
        .order_by(Transaction.date_issue.desc(), Transaction.id)
        .limit(1)
    )
    return ContractFinancials(
        balance=_decimal(balance),
        first_transaction=first_transaction,
        last_transaction=last_transaction,
    )
