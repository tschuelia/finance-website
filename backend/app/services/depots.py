from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import DepotAsset, DepotAssetTransaction, User
from app.services.access import get_visible_bank_depot, get_visible_depot_asset

ZERO = Decimal("0")


@dataclass(frozen=True, slots=True)
class DepotFinancials:
    balance: Decimal
    last_update: date


@dataclass(frozen=True, slots=True)
class DepotAssetFinancials:
    balance: Decimal
    transaction_total: Decimal


def _decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def get_depot_financials(
    session: Session,
    current_user: User,
    depot_id: int,
    *,
    today: date | None = None,
) -> DepotFinancials:
    depot = get_visible_bank_depot(session, current_user, depot_id)
    balance, last_update = session.execute(
        select(
            func.sum(DepotAsset.current_balance),
            func.max(DepotAsset.last_update),
        ).where(DepotAsset.bank_depot_id == depot.id)
    ).one()
    return DepotFinancials(
        balance=_decimal(balance),
        last_update=last_update or today or date.today(),
    )


def get_depot_asset_financials(
    session: Session,
    current_user: User,
    depot_id: int,
    asset_id: int,
) -> DepotAssetFinancials:
    asset = get_visible_depot_asset(session, current_user, depot_id, asset_id)
    transaction_total = session.scalar(
        select(func.sum(DepotAssetTransaction.amount)).where(
            DepotAssetTransaction.asset_id == asset.id
        )
    )
    return DepotAssetFinancials(
        balance=asset.current_balance,
        transaction_total=_decimal(transaction_total),
    )
