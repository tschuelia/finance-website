from pathlib import Path
from typing import Self

from pydantic import Field, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.exceptions import SettingsError


class ConfigurationError(RuntimeError):
    """Raised when application configuration is missing or invalid."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FINANCES_",
        env_file=None,
        extra="ignore",
    )

    database_path: Path = Path("db.sqlite3")
    media_root: Path = Path("media")
    session_secret: SecretStr = Field(min_length=32)
    cookie_secure: bool = False
    session_lifetime_seconds: int = Field(default=14 * 24 * 60 * 60, gt=0)
    allowed_hosts: list[str] = Field(
        default_factory=lambda: ["localhost", "127.0.0.1", "testserver"]
    )
    development_logging: bool = True

    @field_validator("database_path", "media_root")
    @classmethod
    def resolve_path(cls, value: Path) -> Path:
        return value.expanduser().resolve()

    @model_validator(mode="after")
    def validate_allowed_hosts(self) -> Self:
        if not self.allowed_hosts:
            raise ValueError("allowed_hosts must contain at least one host")

        for host in self.allowed_hosts:
            if not host or host != host.strip():
                raise ValueError("allowed_hosts entries must be non-empty and trimmed")
            if "/" in host or "://" in host:
                raise ValueError("allowed_hosts entries must be host names, not URLs")
            if "*" in host[1:] or (
                host.startswith("*") and host != "*" and not host.startswith("*.")
            ):
                raise ValueError("allowed_hosts contains an invalid wildcard")

        return self


def load_settings() -> Settings:
    try:
        return Settings()  # type: ignore[call-arg]
    except SettingsError:
        raise ConfigurationError("Missing or invalid FINANCES_* configuration") from None
    except ValidationError as exc:
        fields = sorted(
            {f"FINANCES_{str(error['loc'][0]).upper()}" for error in exc.errors() if error["loc"]}
        )
        field_list = ", ".join(fields) if fields else "FINANCES_*"
        raise ConfigurationError(f"Missing or invalid configuration: {field_list}") from None
