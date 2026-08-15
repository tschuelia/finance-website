from ipaddress import ip_network
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
    csv_upload_max_bytes: int = Field(default=5 * 1024 * 1024, ge=1)
    contract_upload_max_bytes: int = Field(default=25 * 1024 * 1024, ge=1)
    allowed_hosts: list[str] = Field(
        default_factory=lambda: ["localhost", "127.0.0.1", "testserver"]
    )
    trusted_proxy_ips: list[str] = Field(default_factory=list)
    development_logging: bool = True
    production_mode: bool = False

    @field_validator("database_path", "media_root")
    @classmethod
    def resolve_path(cls, value: Path) -> Path:
        return value.expanduser().resolve()

    @field_validator("trusted_proxy_ips")
    @classmethod
    def validate_trusted_proxy_ips(cls, values: list[str]) -> list[str]:
        for value in values:
            try:
                ip_network(value, strict=False)
            except ValueError:
                raise ValueError(
                    "trusted_proxy_ips entries must be IP addresses or CIDR networks"
                ) from None
        return values

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

        if self.production_mode:
            if not self.cookie_secure:
                raise ValueError("cookie_secure must be enabled in production mode")
            if "*" in self.allowed_hosts:
                raise ValueError("allowed_hosts must not contain '*' in production mode")
            if self.development_logging:
                raise ValueError("development_logging must be disabled in production mode")

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
