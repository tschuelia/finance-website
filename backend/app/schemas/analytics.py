from datetime import date
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.types import ApiDecimal
from app.services.transactions import TransactionType


class AnalyticsFilterQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date_start: date | None = None
    date_end: date | None = None
    amount_min: Decimal | None = Field(default=None, ge=0)
    amount_max: Decimal | None = Field(default=None, ge=0)
    category_ids: list[int] = Field(default_factory=list)
    transaction_type: TransactionType = TransactionType.ALL

    @model_validator(mode="after")
    def validate_ranges(self) -> Self:
        if (
            self.date_start is not None
            and self.date_end is not None
            and self.date_start > self.date_end
        ):
            raise ValueError("date_start must not be after date_end")
        if (
            self.amount_min is not None
            and self.amount_max is not None
            and self.amount_min > self.amount_max
        ):
            raise ValueError("amount_min must not exceed amount_max")
        return self


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
