"""Bounded helpers for request uploads."""

from collections.abc import Iterator
from typing import BinaryIO

from app.errors import PayloadTooLargeError

UPLOAD_CHUNK_SIZE = 64 * 1024


def iter_limited_upload(source: BinaryIO, *, maximum_bytes: int) -> Iterator[bytes]:
    """Yield upload chunks while enforcing the configured byte limit."""
    consumed = 0
    while chunk := source.read(min(UPLOAD_CHUNK_SIZE, maximum_bytes - consumed + 1)):
        consumed += len(chunk)
        if consumed > maximum_bytes:
            raise PayloadTooLargeError()
        yield chunk


def read_limited_upload(source: BinaryIO, *, maximum_bytes: int) -> bytes:
    """Read a small upload into memory without exceeding the configured limit."""
    return b"".join(iter_limited_upload(source, maximum_bytes=maximum_bytes))
