from dataclasses import dataclass
from enum import StrEnum


class MatchStatus(StrEnum):
    NONE = "none"
    UNIQUE = "unique"
    AMBIGUOUS = "ambiguous"


@dataclass(frozen=True, slots=True)
class MatchCandidate:
    id: int
    name: str
    matched_patterns: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class RuleMatch:
    status: MatchStatus
    candidates: tuple[MatchCandidate, ...]


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


def rule_match(candidates: tuple[MatchCandidate, ...]) -> RuleMatch:
    if not candidates:
        status = MatchStatus.NONE
    elif len(candidates) == 1:
        status = MatchStatus.UNIQUE
    else:
        status = MatchStatus.AMBIGUOUS
    return RuleMatch(status=status, candidates=candidates)
