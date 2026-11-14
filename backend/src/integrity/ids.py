"""Build and validate the brief's identifier formats. Pure functions."""

import re

YEAR = 2026

_PATTERNS = {
    "reviewer": re.compile(r"^REV-\d{6}$"),
    "learner": re.compile(r"^LRN-\d{6}$"),
    "assessment": re.compile(r"^ASM-\d{6}$"),
    "rule": re.compile(rf"^INT-{YEAR}-\d{{6}}$"),
    "submission": re.compile(rf"^SUB-{YEAR}-\d{{6}}$"),
    "report": re.compile(rf"^SIM-SUB-{YEAR}-\d{{6}}-\d{{2}}$"),
    "case": re.compile(rf"^CAS-{YEAR}-\d{{6}}$"),
    "evidence": re.compile(rf"^EVD-CAS-{YEAR}-\d{{6}}-\d{{3}}$"),
    "decision": re.compile(rf"^DEC-CAS-{YEAR}-\d{{6}}-\d{{2}}$"),
    "appeal": re.compile(rf"^APL-CAS-{YEAR}-\d{{6}}-\d{{2}}$"),
}


def reviewer_id(n: int) -> str:
    return f"REV-{n:06d}"


def learner_id(n: int) -> str:
    return f"LRN-{n:06d}"


def assessment_id(n: int) -> str:
    return f"ASM-{n:06d}"


def rule_id(n: int) -> str:
    return f"INT-{YEAR}-{n:06d}"


def submission_id(n: int) -> str:
    return f"SUB-{YEAR}-{n:06d}"


def report_id(submission: str) -> str:
    """Report id embeds its submission; there are no rescans, so the suffix is always 01."""
    return f"SIM-{submission}-01"


def case_id(n: int) -> str:
    return f"CAS-{YEAR}-{n:06d}"


def evidence_id(case: str, n: int) -> str:
    return f"EVD-{case}-{n:03d}"


def decision_id(case: str, n: int) -> str:
    return f"DEC-{case}-{n:02d}"


def appeal_id(case: str) -> str:
    """One appeal per case, so the suffix is always 01."""
    return f"APL-{case}-01"


def is_valid(kind: str, value: str) -> bool:
    """True when `value` has the id format of `kind` (reviewer, learner, case, evidence, ...)."""
    return _PATTERNS[kind].match(value) is not None


def next_suffix(existing: list[str]) -> int:
    """Next child counter given existing child ids of one case (max suffix + 1, 1 when empty)."""
    return max((int(i.rsplit("-", 1)[1]) for i in existing), default=0) + 1
