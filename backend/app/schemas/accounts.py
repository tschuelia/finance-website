from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class UserSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    username: str
    first_name: str
    last_name: str
    is_superuser: bool


class AccountSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    bank: str
    current_amount: Decimal
    balance: Decimal
    oldest_transaction_date: date
    newest_transaction_date: date
    maximum_absolute_transaction_amount: Decimal


class DepotSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    balance: Decimal
    last_update: date


class PortfolioGroupResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    owner: UserSummary
    accounts: list[AccountSummary]
    depots: list[DepotSummary]
    balance: Decimal


class PortfolioOverviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    groups: list[PortfolioGroupResponse]
    total_balance: Decimal


class DepotAssetTransactionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    amount: Decimal
    date_issue: date


class DepotAssetResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    current_balance: Decimal
    last_update: date
    transaction_total: Decimal
    transactions: list[DepotAssetTransactionResponse]


class DepotDetailResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    owner: UserSummary
    balance: Decimal
    last_update: date
    assets: list[DepotAssetResponse]


class DepotAssetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_balance: Decimal = Field(max_digits=10, decimal_places=2)
    last_update: date
