from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    BankDepot,
    DepotAsset,
    DepotAssetBalanceSnapshot,
    DepotAssetTransaction,
    DepotBalanceSnapshot,
    User,
)
from app.services.access import get_visible_bank_depot, get_visible_depot_asset

ZERO = Decimal("0")
BERLIN_TIME_ZONE = ZoneInfo("Europe/Berlin")


@dataclass(frozen=True, slots=True)
class DepotFinancials:
    balance: Decimal
    last_update: date


@dataclass(frozen=True, slots=True)
class DepotAssetFinancials:
    balance: Decimal
    transaction_total: Decimal


@dataclass(frozen=True, slots=True)
class DepotBalancePoint:
    date: date
    balance: Decimal


@dataclass(frozen=True, slots=True)
class DepotAssetOverview:
    asset: DepotAsset
    transactions: tuple[DepotAssetTransaction, ...]
    balance_history: tuple[DepotBalancePoint, ...]


@dataclass(frozen=True, slots=True)
class DepotOverview:
    depot: BankDepot
    financials: DepotFinancials
    assets: tuple[DepotAssetOverview, ...]
    balance_history: tuple[DepotBalancePoint, ...]


def _decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _today_in_berlin() -> date:
    return datetime.now(BERLIN_TIME_ZONE).date()


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
        last_update=last_update or today or _today_in_berlin(),
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


def get_depot_asset_balance_history(
    session: Session,
    current_user: User,
    depot_id: int,
    asset_id: int,
) -> tuple[DepotBalancePoint, ...]:
    asset = get_visible_depot_asset(session, current_user, depot_id, asset_id)
    return tuple(
        DepotBalancePoint(date=snapshot.date, balance=snapshot.balance)
        for snapshot in session.scalars(
            select(DepotAssetBalanceSnapshot)
            .where(DepotAssetBalanceSnapshot.asset_id == asset.id)
            .order_by(DepotAssetBalanceSnapshot.date, DepotAssetBalanceSnapshot.id)
        )
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
    balance_history_by_asset: dict[int, list[DepotBalancePoint]] = {
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
        for snapshot in session.scalars(
            select(DepotAssetBalanceSnapshot)
            .where(DepotAssetBalanceSnapshot.asset_id.in_(balance_history_by_asset))
            .order_by(
                DepotAssetBalanceSnapshot.date,
                DepotAssetBalanceSnapshot.id,
            )
        ):
            balance_history_by_asset[snapshot.asset_id].append(
                DepotBalancePoint(date=snapshot.date, balance=snapshot.balance)
            )

    return DepotOverview(
        depot=depot,
        financials=get_depot_financials(session, current_user, depot.id, today=today),
        assets=tuple(
            DepotAssetOverview(
                asset=asset,
                transactions=tuple(transactions_by_asset[asset.id]),
                balance_history=tuple(balance_history_by_asset[asset.id]),
            )
            for asset in assets
        ),
        balance_history=tuple(
            DepotBalancePoint(date=snapshot.date, balance=snapshot.balance)
            for snapshot in session.scalars(
                select(DepotBalanceSnapshot)
                .where(DepotBalanceSnapshot.bank_depot_id == depot.id)
                .order_by(DepotBalanceSnapshot.date, DepotBalanceSnapshot.id)
            )
        ),
    )


def update_depot_asset(
    session: Session,
    current_user: User,
    depot_id: int,
    asset_id: int,
    *,
    current_balance: Decimal,
    today: date | None = None,
) -> DepotAsset:
    asset = get_visible_depot_asset(session, current_user, depot_id, asset_id)
    snapshot_date = today or _today_in_berlin()
    asset.current_balance = current_balance
    asset.last_update = snapshot_date
    session.flush()

    asset_snapshot = session.scalar(
        select(DepotAssetBalanceSnapshot).where(
            DepotAssetBalanceSnapshot.asset_id == asset.id,
            DepotAssetBalanceSnapshot.date == snapshot_date,
        )
    )
    if asset_snapshot is None:
        session.add(
            DepotAssetBalanceSnapshot(
                asset_id=asset.id,
                date=snapshot_date,
                balance=current_balance,
            )
        )
    else:
        asset_snapshot.balance = current_balance

    balance = get_depot_financials(
        session,
        current_user,
        depot_id,
        today=snapshot_date,
    ).balance
    snapshot = session.scalar(
        select(DepotBalanceSnapshot).where(
            DepotBalanceSnapshot.bank_depot_id == depot_id,
            DepotBalanceSnapshot.date == snapshot_date,
        )
    )
    if snapshot is None:
        session.add(
            DepotBalanceSnapshot(
                bank_depot_id=depot_id,
                date=snapshot_date,
                balance=balance,
            )
        )
    else:
        snapshot.balance = balance
    session.flush()
    return asset
