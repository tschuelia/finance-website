from io import BytesIO

import pytest

from app.errors import PayloadTooLargeError
from app.uploads import read_limited_upload


def test_upload_size_boundary() -> None:
    assert read_limited_upload(BytesIO(b"1234"), maximum_bytes=4) == b"1234"


def test_upload_one_byte_over_boundary_is_rejected() -> None:
    with pytest.raises(PayloadTooLargeError):
        read_limited_upload(BytesIO(b"12345"), maximum_bytes=4)
