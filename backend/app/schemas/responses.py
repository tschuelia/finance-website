from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"]


class ValidationIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location: list[str | int]
    message: str
    code: str


class ProblemDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    title: str
    status: int
    detail: str
    instance: str
    request_id: str
    errors: list[ValidationIssue] | None = None
