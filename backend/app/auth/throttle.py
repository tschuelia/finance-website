"""Small in-process throttle for repeated failed authentication attempts."""

from collections.abc import Callable
from dataclasses import dataclass
from hashlib import sha256
from math import ceil
from threading import RLock
from time import monotonic

INITIAL_DELAY_SECONDS = 0.25
MAX_DELAY_SECONDS = 4.0
ENTRY_TTL_SECONDS = 60.0 * 60.0
MAX_ENTRIES = 2_048


@dataclass(slots=True)
class _FailedAttempt:
    failures: int
    retry_after: float
    last_seen: float


class LoginThrottle:
    """Bounded-memory exponential delay state for a single application process."""

    def __init__(self, *, clock: Callable[[], float] = monotonic) -> None:
        self._attempts: dict[str, _FailedAttempt] = {}
        self._lock = RLock()
        self._clock = clock

    def attempt_key(self, *, client_host: str | None, username: str) -> str:
        value = f"{client_host or 'unknown'}\0{username}".encode()
        return sha256(value).hexdigest()

    def delay_seconds(self, key: str) -> float:
        now = self._clock()
        with self._lock:
            self._discard_stale_attempts(now)
            attempt = self._attempts.get(key)
            if attempt is None:
                return 0.0
            attempt.last_seen = now
            return max(0.0, attempt.retry_after - now)

    def retry_after_seconds(self, key: str) -> int:
        return max(1, ceil(self.delay_seconds(key)))

    def register_failure(self, key: str) -> None:
        now = self._clock()
        with self._lock:
            self._discard_stale_attempts(now)
            attempt = self._attempts.get(key)
            failures = 1 if attempt is None else attempt.failures + 1
            delay = min(
                INITIAL_DELAY_SECONDS * (2 ** min(failures - 1, 4)),
                MAX_DELAY_SECONDS,
            )
            self._attempts[key] = _FailedAttempt(
                failures=failures,
                retry_after=now + delay,
                last_seen=now,
            )
            self._trim_attempts()

    def register_success(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._attempts.clear()

    @property
    def entry_count(self) -> int:
        with self._lock:
            return len(self._attempts)

    def _discard_stale_attempts(self, now: float) -> None:
        stale_keys = [
            key
            for key, attempt in self._attempts.items()
            if now - attempt.last_seen >= ENTRY_TTL_SECONDS
        ]
        for key in stale_keys:
            del self._attempts[key]

    def _trim_attempts(self) -> None:
        excess = len(self._attempts) - MAX_ENTRIES
        if excess <= 0:
            return
        oldest_keys = sorted(self._attempts, key=lambda key: self._attempts[key].last_seen)
        for key in oldest_keys[:excess]:
            del self._attempts[key]


login_throttle = LoginThrottle()
