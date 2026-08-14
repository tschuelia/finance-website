from datetime import date
from decimal import Decimal
from typing import Any

from conftest import add_account, add_user
from sqlalchemy import Engine, event
from sqlalchemy.orm import Session

from app.db.models import BankDepot, DepotAsset
from app.services.accounts import get_portfolio_overview


def _portfolio_query_count(session: Session, username: str, item_count: int) -> int:
    user = add_user(session, username, is_superuser=True)
    for index in range(item_count):
        add_account(session, user, name=f"Konto {index}")
        depot = BankDepot(name=f"Depot {index}", owner_id=user.id)
        session.add(depot)
        session.flush()
        session.add(
            DepotAsset(
                name=f"Anlage {index}",
                current_balance=Decimal("10.00"),
                bank_depot_id=depot.id,
                last_update=date(2026, 8, 14),
            )
        )
    session.flush()

    query_count = 0

    def count_query(*_args: Any, **_kwargs: Any) -> None:
        nonlocal query_count
        query_count += 1

    engine = session.get_bind()
    assert isinstance(engine, Engine)
    event.listen(engine, "before_cursor_execute", count_query)
    try:
        overview = get_portfolio_overview(session, user, today=date(2026, 8, 14))
        assert len(overview.groups[0].accounts) == item_count
        assert len(overview.groups[0].depots) == item_count
    finally:
        event.remove(engine, "before_cursor_execute", count_query)
    return query_count


def test_portfolio_query_count_is_constant_as_lists_grow(session: Session) -> None:
    small_count = _portfolio_query_count(session, "small", 1)
    session.rollback()
    large_count = _portfolio_query_count(session, "large", 20)
    assert small_count == large_count == 3
