from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import BankDepot, DepotAsset, DepotAssetTransaction, User
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


@dataclass(frozen=True, slots=True)
class DepotAssetOverview:
    asset: DepotAsset
    transactions: tuple[DepotAssetTransaction, ...]


@dataclass(frozen=True, slots=True)
class DepotOverview:
    depot: BankDepot
    financials: DepotFinancials
    assets: tuple[DepotAssetOverview, ...]


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


def get_depot_overview(
    session: Session,
    current_user: User,
    depot_id: int,
    *,
    today: date | None = None,
) -> DepotOverview:
    depot = get_visible_bank_depot(session, current_user, depot_id)
    assets = tuple(
        session.scalars(
            select(DepotAsset)
            .where(DepotAsset.bank_depot_id == depot.id)
            .order_by(DepotAsset.name, DepotAsset.id)
        )
    )
    transactions_by_asset: dict[int, list[DepotAssetTransaction]] = {
        asset.id: [] for asset in assets
    }
    if transactions_by_asset:
        for transaction in session.scalars(
            select(DepotAssetTransaction)
            .where(DepotAssetTransaction.asset_id.in_(transactions_by_asset))
            .order_by(
                DepotAssetTransaction.date_issue.desc(),
                DepotAssetTransaction.id.desc(),
            )
        ):
            if transaction.asset_id is not None:
                transactions_by_asset[transaction.asset_id].append(transaction)

    return DepotOverview(
        depot=depot,
        financials=get_depot_financials(session, current_user, depot.id, today=today),
        assets=tuple(
            DepotAssetOverview(
                asset=asset,
                transactions=tuple(transactions_by_asset[asset.id]),
            )
            for asset in assets
        ),
    )


def update_depot_asset(
    session: Session,
    current_user: User,
    depot_id: int,
    asset_id: int,
    *,
    current_balance: Decimal,
    last_update: date,
) -> DepotAsset:
    asset = get_visible_depot_asset(session, current_user, depot_id, asset_id)
    asset.current_balance = current_balance
    asset.last_update = last_update
    session.flush()
    return asset
