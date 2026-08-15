from pydantic import BaseModel, ConfigDict, Field

from app.imports import MAX_CSV_ROWS
from app.schemas.transactions import TransactionResponse, TransactionWrite


class CsvPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionWrite] = Field(min_length=1, max_length=MAX_CSV_ROWS)


class CsvCommitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionWrite] = Field(min_length=1, max_length=MAX_CSV_ROWS)


class CsvCommitResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionResponse]
    created: int
