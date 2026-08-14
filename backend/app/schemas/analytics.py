from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.transactions import TransactionDataFilterQuery
from app.schemas.types import ApiDecimal


class AnalyticsFilterQuery(TransactionDataFilterQuery):
    pass


class ComparisonQuery(AnalyticsFilterQuery):
    periods: list[str] = Field(min_length=3, max_length=3)

    @field_validator("periods")
    @classmethod
    def validate_periods(cls, periods: list[str]) -> list[str]:
        for period in periods:
            try:
                if len(period) == 4:
                    date(int(period), 1, 1)
                    continue
                year_text, month_text = period.split("-", maxsplit=1)
                date(int(year_text), int(month_text), 1)
            except ValueError:
                raise ValueError(
                    "periods entries must be ISO years (YYYY) or months (YYYY-MM)"
                ) from None
        return periods


class MonthlyQuery(AnalyticsFilterQuery):
    months: int = Field(default=12, ge=1, le=120)


class CategoryTotalResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str
    income: ApiDecimal
    expense: ApiDecimal


class CategoryTotalsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    income_color: str = "darkseagreen"
    expense_color: str = "indianred"
    series: list[CategoryTotalResponse]


class ComparisonPeriodResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period: str
    label: str
    series: list[CategoryTotalResponse]


class CategoryComparisonsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    income_color: str = "darkseagreen"
    expense_color: str = "indianred"
    comparisons: list[ComparisonPeriodResponse]


class MonthlyTotalResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period: str
    label: str
    income: ApiDecimal
    expense: ApiDecimal


class MonthlyTotalsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    income_color: str = "darkseagreen"
    expense_color: str = "indianred"
    series: list[MonthlyTotalResponse]
