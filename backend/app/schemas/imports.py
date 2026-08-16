from pydantic import BaseModel, ConfigDict, Field

from app.imports import MAX_CSV_ROWS
from app.schemas.matching import RuleMatchResponse
from app.schemas.transactions import TransactionResponse, TransactionWrite


class CsvPreviewRowResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_row: int
    transaction: TransactionWrite
    category_match: RuleMatchResponse
    contract_match: RuleMatchResponse


class CsvSkippedRowResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_row: int
    reason: str


class CsvPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CsvPreviewRowResponse] = Field(min_length=1, max_length=MAX_CSV_ROWS)
    skipped_rows: list[CsvSkippedRowResponse] = Field(default_factory=list)


class CsvCommitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionWrite] = Field(min_length=1, max_length=MAX_CSV_ROWS)


class CsvCommitResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionResponse]
    created: int
