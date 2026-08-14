from decimal import Decimal
from math import isfinite
from typing import Annotated

from pydantic import BeforeValidator, PlainSerializer, WithJsonSchema


def _api_decimal(value: object) -> Decimal:
    if isinstance(value, Decimal):
        decimal = value
    elif isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError("value must be a JSON number")
    elif isinstance(value, float) and not isfinite(value):
        raise ValueError("value must be finite")
    else:
        decimal = Decimal(str(value))

    if not decimal.is_finite():
        raise ValueError("value must be finite")

    return decimal


ApiDecimal = Annotated[
    Decimal,
    BeforeValidator(_api_decimal),
    WithJsonSchema({"type": "number"}, mode="validation"),
    PlainSerializer(float, return_type=float, when_used="json"),
]
