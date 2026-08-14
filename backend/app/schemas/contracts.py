from datetime import date
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.accounts import UserSummary
from app.schemas.transactions import TransactionResponse
from app.schemas.types import ApiDecimal


class ContractFileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    filename: str
    download_url: str


class ContractSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    owner: UserSummary
    description: str | None
    is_active: bool
    start_date: date | None
    end_date: date | None


class ContractListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    active: list[ContractSummaryResponse]
    inactive: list[ContractSummaryResponse]


class ContractDetailResponse(ContractSummaryResponse):
    balance: ApiDecimal
    first_transaction_date: date | None
    last_transaction_date: date | None
    transactions: list[TransactionResponse]
    files: list[ContractFileResponse]


class ContractWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    owner_id: int
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    is_active: bool = True
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> Self:
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.start_date > self.end_date
        ):
            raise ValueError("start_date must not be after end_date")
        return self
