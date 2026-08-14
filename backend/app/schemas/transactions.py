from datetime import date
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.types import ApiDecimal
from app.services.transactions import TransactionType


class TransactionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    bank_account_id: int | None
    recipient: str
    amount: ApiDecimal
    subject: str
    date_issue: date
    date_booking: date | None
    full_subject_string: str
    category_id: int | None
    category_name: str | None
    contract_id: int | None
    contract_name: str | None


class TransactionSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: ApiDecimal
    paid: ApiDecimal
    received: ApiDecimal
    minimum_date: date | None
    maximum_date: date | None


class TransactionPageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
    summary: TransactionSummaryResponse


class TransactionWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    bank_account_id: int
    recipient: str | None = Field(default=None, max_length=255)
    amount: ApiDecimal = Field(max_digits=10, decimal_places=2)
    subject: str = Field(max_length=1024)
    date_issue: date
    date_booking: date | None = None
    full_subject_string: str | None = None
    category_id: int | None = None
    contract_id: int | None = None

    @model_validator(mode="after")
    def fill_legacy_optional_text(self) -> Self:
        if self.recipient is None:
            self.recipient = ""
        if self.full_subject_string is None:
            self.full_subject_string = self.subject
        return self


class TransactionDataFilterQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str | None = None
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


class TransactionFilterQuery(TransactionDataFilterQuery):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=100, ge=1, le=500)
