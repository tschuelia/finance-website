from __future__ import annotations

import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def legacy_foreign_key(target: str) -> ForeignKey:
    return ForeignKey(target, deferrable=True, initially="DEFERRED")


class User(Base):
    __tablename__ = "auth_user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    password: Mapped[str] = mapped_column(String(128))
    last_login: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean)
    username: Mapped[str] = mapped_column(String(150), unique=True)
    last_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(254))
    is_staff: Mapped[bool] = mapped_column(Boolean)
    is_active: Mapped[bool] = mapped_column(Boolean)
    date_joined: Mapped[datetime.datetime] = mapped_column(DateTime)
    first_name: Mapped[str] = mapped_column(String(150))

    bank_accounts: Mapped[list[BankAccount]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    bank_depots: Mapped[list[BankDepot]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    contracts: Mapped[list[Contract]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    sessions: Mapped[list[ServerSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class BankAccount(Base):
    __tablename__ = "accounting_bankaccount"
    __table_args__ = (Index("accounting_bankaccount_owner_id_a451fc73", "owner_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    bank: Mapped[str] = mapped_column(String(255))
    current_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    owner_id: Mapped[int] = mapped_column(Integer, legacy_foreign_key("auth_user.id"))

    owner: Mapped[User] = relationship(back_populates="bank_accounts")
    transactions: Mapped[list[Transaction]] = relationship(back_populates="bank_account")


class BankDepot(Base):
    __tablename__ = "accounting_bankdepot"
    __table_args__ = (Index("accounting_bankdepot_owner_id_b63f67ab", "owner_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    owner_id: Mapped[int] = mapped_column(Integer, legacy_foreign_key("auth_user.id"))

    owner: Mapped[User] = relationship(back_populates="bank_depots")
    assets: Mapped[list[DepotAsset]] = relationship(back_populates="bank_depot")


class DepotAsset(Base):
    __tablename__ = "accounting_depotasset"
    __table_args__ = (Index("accounting_depotasset_bank_depot_id_167d5621", "bank_depot_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    current_balance: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    bank_depot_id: Mapped[int | None] = mapped_column(
        BigInteger, legacy_foreign_key("accounting_bankdepot.id"), nullable=True
    )
    last_update: Mapped[datetime.date] = mapped_column(Date)

    bank_depot: Mapped[BankDepot | None] = relationship(back_populates="assets")
    transactions: Mapped[list[DepotAssetTransaction]] = relationship(back_populates="asset")


class DepotAssetTransaction(Base):
    __tablename__ = "accounting_depotassettransaction"
    __table_args__ = (Index("accounting_depotassettransaction_asset_id_fd10fa10", "asset_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    date_issue: Mapped[datetime.date] = mapped_column(Date)
    asset_id: Mapped[int | None] = mapped_column(
        BigInteger, legacy_foreign_key("accounting_depotasset.id"), nullable=True
    )

    asset: Mapped[DepotAsset | None] = relationship(back_populates="transactions")


class Category(Base):
    __tablename__ = "accounting_category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    patterns: Mapped[str] = mapped_column(Text)

    transactions: Mapped[list[Transaction]] = relationship(back_populates="category")


class Contract(Base):
    __tablename__ = "accounting_contract"
    __table_args__ = (Index("accounting_contract_owner_id_f118a281", "owner_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[int] = mapped_column(Integer, legacy_foreign_key("auth_user.id"))
    is_active: Mapped[bool] = mapped_column(Boolean)
    end_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    start_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)

    owner: Mapped[User] = relationship(back_populates="contracts")
    files: Mapped[list[ContractFile]] = relationship(
        back_populates="contract", cascade="all, delete-orphan"
    )
    transactions: Mapped[list[Transaction]] = relationship(back_populates="contract")


class ContractFile(Base):
    __tablename__ = "accounting_contractfile"
    __table_args__ = (Index("accounting_contractfile_contract_id_b8a6335e", "contract_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file: Mapped[str] = mapped_column(String(100))
    filename: Mapped[str] = mapped_column(String(255))
    contract_id: Mapped[int] = mapped_column(
        BigInteger, legacy_foreign_key("accounting_contract.id")
    )

    contract: Mapped[Contract] = relationship(back_populates="files")


class Transaction(Base):
    __tablename__ = "accounting_transaction"
    __table_args__ = (
        Index("accounting_transaction_bank_account_id_903676bb", "bank_account_id"),
        Index("accounting_transaction_category_id_3bec2add", "category_id"),
        Index("accounting_transaction_contract_id_be87a27f", "contract_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipient: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    subject: Mapped[str] = mapped_column(String(1024))
    date_issue: Mapped[datetime.date] = mapped_column(Date)
    date_booking: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    full_subject_string: Mapped[str] = mapped_column(Text)
    bank_account_id: Mapped[int | None] = mapped_column(
        BigInteger, legacy_foreign_key("accounting_bankaccount.id"), nullable=True
    )
    category_id: Mapped[int | None] = mapped_column(
        BigInteger, legacy_foreign_key("accounting_category.id"), nullable=True
    )
    contract_id: Mapped[int | None] = mapped_column(
        BigInteger, legacy_foreign_key("accounting_contract.id"), nullable=True
    )

    bank_account: Mapped[BankAccount | None] = relationship(back_populates="transactions")
    category: Mapped[Category | None] = relationship(back_populates="transactions")
    contract: Mapped[Contract | None] = relationship(back_populates="transactions")


class ServerSession(Base):
    __tablename__ = "finances_session"
    __table_args__ = (
        Index("finances_session_user_id_idx", "user_id"),
        Index("finances_session_expires_at_idx", "expires_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, legacy_foreign_key("auth_user.id"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_token_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship(back_populates="sessions")


LEGACY_MANAGED_TABLE_NAMES = frozenset(
    {
        "auth_user",
        "accounting_bankaccount",
        "accounting_bankdepot",
        "accounting_category",
        "accounting_contract",
        "accounting_contractfile",
        "accounting_depotasset",
        "accounting_depotassettransaction",
        "accounting_transaction",
    }
)

MANAGED_TABLE_NAMES = LEGACY_MANAGED_TABLE_NAMES | {ServerSession.__tablename__}
