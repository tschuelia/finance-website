from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.accounts import UserSummary
from app.schemas.transactions import TransactionResponse
from app.services.transfers import (
    TransferMatchStatus,
    TransferReviewAction,
    TransferReviewStatus,
)


class TransferReviewQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: TransferReviewStatus = TransferReviewStatus.SUGGESTED
    owner_id: int | None = None
    account_id: int | None = None
    q: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)


class TransferPairResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outgoing: TransactionResponse
    outgoing_owner: UserSummary
    incoming: TransactionResponse
    incoming_owner: UserSummary
    day_gap: int
    match_status: TransferMatchStatus


class TransferReviewPageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransferPairResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class TransferReviewUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outgoing_transaction_id: int
    incoming_transaction_id: int
    action: TransferReviewAction


class TransferReviewUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransferReviewUpdate] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_unique_pairs(self) -> Self:
        pairs = [
            (item.outgoing_transaction_id, item.incoming_transaction_id) for item in self.items
        ]
        if len(set(pairs)) != len(pairs):
            raise ValueError("a transfer pair may only be changed once per request")
        return self


class TransferReviewUpdateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    updated: int
