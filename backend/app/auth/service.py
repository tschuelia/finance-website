"""Authentication service operations independent of HTTP transport."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.passwords import hash_password, password_needs_rehash, verify_password
from app.db.models import User

# A valid hash keeps an unknown-user login attempt close to the cost of a real one.
DUMMY_PASSWORD_HASH = (
    "pbkdf2_sha256$1000000$xK4YV6sZ1bC3dF5gH7jL9m$D2hz8BprN76Ne71k88ykbORWwuMuEgFhd3RGFcCqzMo="
)


def authenticate_user(session: Session, username: str, password: str) -> User | None:
    """Authenticate a user and upgrade an imported password hash when needed."""
    user = session.scalar(select(User).where(User.username == username))
    encoded_password = user.password if user is not None else DUMMY_PASSWORD_HASH
    password_is_valid = verify_password(encoded_password, password)
    if user is None or not user.is_active or not password_is_valid:
        return None
    if password_needs_rehash(encoded_password):
        user.password = hash_password(password)
    return user
