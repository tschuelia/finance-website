from datetime import date
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.types import ApiDecimal


class DashboardModel(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


def _valid_month(value: str) -> str:
    try:
        year_text, month_text = value.split("-", maxsplit=1)
        date(int(year_text), int(month_text), 1)
    except ValueError:
        raise ValueError("month must use YYYY-MM") from None
    if len(value) != 7:
        raise ValueError("month must use YYYY-MM")
    return value


class MonthRangeQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_month: str | None = None
    end_month: str | None = None

    @field_validator("start_month", "end_month")
    @classmethod
    def validate_month(cls, value: str | None) -> str | None:
        return _valid_month(value) if value is not None else None

    @model_validator(mode="after")
    def validate_range(self) -> Self:
        if (self.start_month is None) != (self.end_month is None):
            raise ValueError("start_month and end_month must be supplied together")
        if self.start_month is not None and self.end_month is not None:
            start = date.fromisoformat(f"{self.start_month}-01")
            end = date.fromisoformat(f"{self.end_month}-01")
            months = (end.year - start.year) * 12 + end.month - start.month + 1
            if months < 1 or months > 120:
                raise ValueError("month range must contain between 1 and 120 months")
        return self


class CashFlowQuery(MonthRangeQuery):
    account_ids: list[int] = Field(default_factory=list)


class WealthQuery(MonthRangeQuery):
    account_ids: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)
    depot_ids: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)

    @field_validator("account_ids", "depot_ids")
    @classmethod
    def deduplicate_sources(cls, values: list[int]) -> list[int]:
        return list(dict.fromkeys(values))

    @model_validator(mode="after")
    def validate_sources(self) -> Self:
        count = len(self.account_ids) + len(self.depot_ids)
        if count < 1 or count > 200:
            raise ValueError("wealth query must contain between 1 and 200 sources")
        return self


class DashboardPeriodResponse(DashboardModel):
    start_month: str
    end_month: str
    label: str
    month_count: int
    is_partial: bool


class ComparedMetricResponse(DashboardModel):
    value: ApiDecimal
    previous_value: ApiDecimal
    absolute_change: ApiDecimal
    percentage_change: ApiDecimal | None


class CashFlowSummaryResponse(DashboardModel):
    income: ComparedMetricResponse
    expense: ComparedMetricResponse
    net: ComparedMetricResponse
    savings_rate: ComparedMetricResponse | None


class MonthlyCashFlowResponse(DashboardModel):
    period: str
    label: str
    income: ApiDecimal
    expense: ApiDecimal
    net: ApiDecimal


class AccountCashFlowResponse(DashboardModel):
    account_id: int
    account_name: str
    owner_name: str
    income: ApiDecimal
    expense: ApiDecimal
    net: ApiDecimal


class CategoryCashFlowResponse(DashboardModel):
    category_id: int | None
    category: str
    expense: ApiDecimal
    previous_expense: ApiDecimal
    share: ApiDecimal
    previous_share: ApiDecimal


class CategoryMonthResponse(DashboardModel):
    period: str
    category_id: int | None
    category: str
    expense: ApiDecimal


class ContractExpenseResponse(DashboardModel):
    contract_id: int
    contract_name: str
    owner_name: str
    is_active: bool
    expense: ApiDecimal
    monthly_average: ApiDecimal
    share: ApiDecimal


class ContractMonthResponse(DashboardModel):
    period: str
    contract_id: int
    expense: ApiDecimal


class SpendingAnomalyResponse(DashboardModel):
    period: str
    category_id: int | None
    category: str
    expense: ApiDecimal
    baseline_median: ApiDecimal
    absolute_change: ApiDecimal
    percentage_change: ApiDecimal | None


class CategoryChangeResponse(DashboardModel):
    category_id: int | None
    category: str
    monthly_average: ApiDecimal
    previous_monthly_average: ApiDecimal
    absolute_change: ApiDecimal
    percentage_change: ApiDecimal | None


class CashFlowDashboardResponse(DashboardModel):
    period: DashboardPeriodResponse
    comparison_period: DashboardPeriodResponse
    data_through: date | None
    account_ids: list[int]
    excluded_transfer_count: int
    summary: CashFlowSummaryResponse
    monthly: list[MonthlyCashFlowResponse]
    accounts: list[AccountCashFlowResponse]
    categories: list[CategoryCashFlowResponse]
    category_monthly: list[CategoryMonthResponse]
    contracts: list[ContractExpenseResponse]
    contract_monthly: list[ContractMonthResponse]
    contract_expense_share: ApiDecimal
    anomalies: list[SpendingAnomalyResponse]
    increases: list[CategoryChangeResponse]
    decreases: list[CategoryChangeResponse]


class WealthPointResponse(DashboardModel):
    period: str
    label: str
    total: ApiDecimal | None
    bank_balance: ApiDecimal
    depot_balance: ApiDecimal | None
    estimated: bool
    coverage: ApiDecimal


class WealthSourceResponse(DashboardModel):
    source_type: Literal["account", "depot"]
    source_id: int
    name: str
    owner_name: str
    balance: ApiDecimal
    last_update: date


class WealthDashboardResponse(DashboardModel):
    period: DashboardPeriodResponse
    current_total: ApiDecimal
    liquid_total: ApiDecimal
    invested_total: ApiDecimal
    period_start_total: ApiDecimal | None
    period_end_total: ApiDecimal | None
    absolute_change: ApiDecimal | None
    percentage_change: ApiDecimal | None
    monthly: list[WealthPointResponse]
    sources: list[WealthSourceResponse]
