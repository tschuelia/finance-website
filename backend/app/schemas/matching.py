from pydantic import BaseModel, ConfigDict

from app.services.matching import MatchStatus, RuleMatch


class MatchCandidateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    matched_patterns: list[str]


class RuleMatchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: MatchStatus
    candidates: list[MatchCandidateResponse]


def rule_match_response(match: RuleMatch) -> RuleMatchResponse:
    return RuleMatchResponse(
        status=match.status,
        candidates=[
            MatchCandidateResponse(
                id=candidate.id,
                name=candidate.name,
                matched_patterns=list(candidate.matched_patterns),
            )
            for candidate in match.candidates
        ],
    )
