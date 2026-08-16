from dataclasses import dataclass
from datetime import date

from sqlalchemy import and_, or_, update
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import Transaction
from app.patterns import normalized_patterns
from app.services.matching import patterns_match_clause


@dataclass(frozen=True, slots=True)
class ContractReviewRule:
    owner_id: int
    patterns: str
    start_date: date | None
    end_date: date | None


def invalidate_category_reviews(session: Session, *pattern_values: str) -> None:
    normalized_values = {
        "\n".join(patterns) for value in pattern_values if (patterns := normalized_patterns(value))
    }
    if not normalized_values:
        return
    session.execute(
        update(Transaction)
        .where(
            Transaction.category_id.is_(None),
            or_(
                *(
                    patterns_match_clause(Transaction.recipient, Transaction.subject, patterns)
                    for patterns in normalized_values
                )
            ),
        )
        .values(category_reviewed=False)
    )


def _contract_rule_clause(rule: ContractReviewRule) -> ColumnElement[bool] | None:
    patterns = "\n".join(normalized_patterns(rule.patterns))
    if not patterns:
        return None
    clauses: list[ColumnElement[bool]] = [
        Transaction.bank_account.has(owner_id=rule.owner_id),
        patterns_match_clause(Transaction.recipient, Transaction.subject, patterns),
    ]
    if rule.start_date is not None:
        clauses.append(Transaction.date_issue >= rule.start_date)
    if rule.end_date is not None:
        clauses.append(Transaction.date_issue <= rule.end_date)
    return and_(*clauses)


def invalidate_contract_reviews(session: Session, *rules: ContractReviewRule) -> None:
    clauses = tuple(clause for rule in rules if (clause := _contract_rule_clause(rule)) is not None)
    if not clauses:
        return
    session.execute(
        update(Transaction)
        .where(Transaction.contract_id.is_(None), or_(*clauses))
        .values(contract_reviewed=False)
    )
