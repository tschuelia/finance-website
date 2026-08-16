from dataclasses import dataclass
from enum import StrEnum

from sqlalchemy import ColumnElement, func
from sqlalchemy.orm import InstrumentedAttribute


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


def patterns_match_clause(
    recipient: ColumnElement[str] | InstrumentedAttribute[str],
    subject: ColumnElement[str] | InstrumentedAttribute[str],
    patterns: ColumnElement[str] | InstrumentedAttribute[str] | str,
) -> ColumnElement[bool]:
    return func.finances_patterns_match(recipient, subject, patterns) == 1


def rule_match(candidates: tuple[MatchCandidate, ...]) -> RuleMatch:
    if not candidates:
        status = MatchStatus.NONE
    elif len(candidates) == 1:
        status = MatchStatus.UNIQUE
    else:
        status = MatchStatus.AMBIGUOUS
    return RuleMatch(status=status, candidates=candidates)
