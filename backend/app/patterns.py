def normalized_patterns(patterns: str) -> tuple[str, ...]:
    seen: set[str] = set()
    normalized: list[str] = []
    for raw_pattern in patterns.splitlines():
        pattern = raw_pattern.strip()
        key = pattern.casefold()
        if not pattern or key in seen:
            continue
        seen.add(key)
        normalized.append(pattern)
    return tuple(normalized)


def match_patterns(
    recipient: str | None,
    subject: str | None,
    patterns: tuple[str, ...],
) -> tuple[str, ...]:
    values = ((recipient or "").casefold(), (subject or "").casefold())
    return tuple(
        pattern for pattern in patterns if any(pattern.casefold() in value for value in values)
    )


def matches_pattern_text(
    recipient: str | None,
    subject: str | None,
    patterns: str,
) -> bool:
    return bool(match_patterns(recipient, subject, normalized_patterns(patterns)))
