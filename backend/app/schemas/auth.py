from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=150)
    password: str = Field(max_length=4_096)


class AuthenticatedUserResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    username: str
    first_name: str
    last_name: str
    email: str
    is_superuser: bool
    is_staff: bool
    csrf_token: str = Field(min_length=1)
    expires_at: datetime
