from concurrent.futures import ThreadPoolExecutor

from app.auth.throttle import ENTRY_TTL_SECONDS, MAX_ENTRIES, LoginThrottle


def test_success_resets_throttle() -> None:
    throttle = LoginThrottle()
    key = throttle.attempt_key(client_host="192.0.2.1", username="alice")
    throttle.register_failure(key)
    assert throttle.delay_seconds(key) > 0
    throttle.register_success(key)
    assert throttle.delay_seconds(key) == 0


def test_throttle_expires_entries_and_bounds_memory() -> None:
    current_time = 0.0
    throttle = LoginThrottle(clock=lambda: current_time)
    stale_key = throttle.attempt_key(client_host="192.0.2.1", username="stale")
    throttle.register_failure(stale_key)
    current_time = ENTRY_TTL_SECONDS
    assert throttle.delay_seconds(stale_key) == 0

    for index in range(MAX_ENTRIES + 10):
        throttle.register_failure(
            throttle.attempt_key(client_host="192.0.2.1", username=f"user-{index}")
        )
    assert throttle.entry_count == MAX_ENTRIES


def test_concurrent_failures_share_one_thread_safe_entry() -> None:
    throttle = LoginThrottle()
    key = throttle.attempt_key(client_host="192.0.2.1", username="alice")
    with ThreadPoolExecutor(max_workers=8) as executor:
        tuple(executor.map(throttle.register_failure, (key for _ in range(32))))
    assert throttle.entry_count == 1
    assert throttle.delay_seconds(key) > 0
