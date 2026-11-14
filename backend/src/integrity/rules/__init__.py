"""Business rules as pure functions: bands, triage, conflicts, lifecycle. No I/O, no clock."""

from integrity.rules.conflicts import (
    ConflictFacts,
    conflict_reasons,
    independence_reasons,
    is_independent,
)
from integrity.rules.lifecycle import (
    TRANSITIONS,
    Actor,
    CaseFacts,
    action_checks,
    allowed_actions,
    check_action,
    guard,
    guard_assignment,
    guard_cited_evidence,
    guard_evidence_kind,
)
from integrity.rules.triage import Scores, Triage, band_for, explain_triage, triage

__all__ = [
    "TRANSITIONS",
    "Actor",
    "CaseFacts",
    "ConflictFacts",
    "Scores",
    "Triage",
    "action_checks",
    "allowed_actions",
    "band_for",
    "check_action",
    "conflict_reasons",
    "explain_triage",
    "guard",
    "guard_assignment",
    "guard_cited_evidence",
    "guard_evidence_kind",
    "independence_reasons",
    "is_independent",
    "triage",
]
