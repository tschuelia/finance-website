"""Django-compatible password hashing for the rollback window."""

from base64 import b64encode
from hashlib import pbkdf2_hmac
from hmac import compare_digest
from math import ceil, log2
from secrets import choice
from string import ascii_letters, digits

DJANGO_PBKDF2_SHA256 = "pbkdf2_sha256"
DJANGO_PBKDF2_ITERATIONS = 1_000_000
DJANGO_SALT_ENTROPY_BITS = 128
DJANGO_SALT_CHARS = ascii_letters + digits
DJANGO_SALT_LENGTH = ceil(DJANGO_SALT_ENTROPY_BITS / log2(len(DJANGO_SALT_CHARS)))


def _encode_django_password(password: str, salt: str, iterations: int) -> str:
    encoded_hash = b64encode(
        pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
    ).decode("ascii")
    return f"{DJANGO_PBKDF2_SHA256}${iterations}${salt}${encoded_hash}"


def verify_django_password(encoded_password: str, password: str) -> bool:
    """Verify a ``pbkdf2_sha256`` value stored by Django without rehashing it."""
    try:
        algorithm, raw_iterations, salt, _ = encoded_password.split("$", maxsplit=3)
        iterations = int(raw_iterations)
    except TypeError, ValueError:
        return False

    if algorithm != DJANGO_PBKDF2_SHA256 or iterations < 1:
        return False

    try:
        candidate = _encode_django_password(password, salt, iterations)
    except OverflowError, ValueError:
        return False
    return compare_digest(candidate, encoded_password)


def hash_django_password(password: str) -> str:
    """Create a new Django-compatible PBKDF2 hash for rollback-compatible CLI use."""
    salt = "".join(choice(DJANGO_SALT_CHARS) for _ in range(DJANGO_SALT_LENGTH))
    return _encode_django_password(password, salt, DJANGO_PBKDF2_ITERATIONS)
