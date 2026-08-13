from pydantic import BaseModel, ConfigDict, Field

from app.schemas.transactions import TransactionResponse, TransactionWrite


class CsvPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionWrite] = Field(min_length=1)


class CsvCommitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionWrite] = Field(min_length=1)


class CsvCommitResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionResponse]
    created: int
