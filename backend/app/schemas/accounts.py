from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.types import ApiDecimal


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
    current_amount: ApiDecimal
    balance: ApiDecimal
    oldest_transaction_date: date
    newest_transaction_date: date
    maximum_absolute_transaction_amount: ApiDecimal


class AccountDetailResponse(AccountSummary):
    owner: UserSummary


class DepotSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    balance: ApiDecimal
    last_update: date


class PortfolioGroupResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    owner: UserSummary
    accounts: list[AccountSummary]
    depots: list[DepotSummary]
    balance: ApiDecimal


class PortfolioOverviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    groups: list[PortfolioGroupResponse]
    total_balance: ApiDecimal


class DepotAssetTransactionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    amount: ApiDecimal
    date_issue: date


class DepotBalancePointResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date
    balance: ApiDecimal


class DepotAssetResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    current_balance: ApiDecimal
    last_update: date
    transaction_total: ApiDecimal
    transactions: list[DepotAssetTransactionResponse]
    balance_history: list[DepotBalancePointResponse]


class DepotDetailResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    owner: UserSummary
    balance: ApiDecimal
    last_update: date
    balance_history: list[DepotBalancePointResponse]
    assets: list[DepotAssetResponse]


class DepotAssetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_balance: ApiDecimal = Field(max_digits=10, decimal_places=2)
