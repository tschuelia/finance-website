"""Password hashing with support for existing Django hashes."""

from base64 import b64encode
from hashlib import pbkdf2_hmac
from hmac import compare_digest

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from argon2.profiles import RFC_9106_LOW_MEMORY

DJANGO_PBKDF2_SHA256 = "pbkdf2_sha256"
ARGON2_PREFIX = "$argon2"
PASSWORD_HASHER = PasswordHasher.from_parameters(RFC_9106_LOW_MEMORY)


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


def verify_password(encoded_password: str, password: str) -> bool:
    """Verify an Argon2 hash or an imported Django PBKDF2 hash."""
    if encoded_password.startswith(ARGON2_PREFIX):
        try:
            return PASSWORD_HASHER.verify(encoded_password, password)
        except InvalidHashError, VerificationError:
            return False
    return verify_django_password(encoded_password, password)


def password_needs_rehash(encoded_password: str) -> bool:
    """Return whether a valid password should be stored with current Argon2 settings."""
    if not encoded_password.startswith(ARGON2_PREFIX):
        return True
    try:
        return PASSWORD_HASHER.check_needs_rehash(encoded_password)
    except InvalidHashError:
        return False


def hash_password(password: str) -> str:
    """Hash a new or replacement password with Argon2id."""
    return PASSWORD_HASHER.hash(password)
