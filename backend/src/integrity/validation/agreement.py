"""Agreement checks: independent derivations of the same facts must tell the same story.

Two checks, each returning a dict with `violations`, `examples` (the disagreements, or the failures)
and, for the reviewer check, `expected_examples` (items every derivation agrees on):
- flag_agreement: Python triage() with the rule each report references must match the v_flag view
  (is_flag, band, opens_case, dismissal_reason). Reports whose score sits exactly on a rule threshold
  must also get the band of the lower-inclusive rule, with thresholds read from integrity_rule.
  A disagreement is a real bug in one of the two.
- reviewer_conflict_rule_vs_auditor_agreement: three derivations of the reviewer conflicts (the Python
  rule engine, the auditor's REVIEWER_CONFLICT SQL, and an independent SQL recount written here) must
  flag the same case_reviewer rows. This checks the implementations agree; it does not prove any is right.
"""

# Long SQL lines read better unwrapped.
# ruff: noqa: E501

from typing import Any

import psycopg
from psycopg.rows import dict_row

from integrity.auditor import audit
from integrity.models import Band, DismissalReason, Role, Rule
from integrity.rules import ConflictFacts, Scores, Triage, conflict_reasons, triage

Row = dict[str, Any]
Assignment = tuple[str, str]  # (case id, reviewer id) of one case_reviewer row
MAX_EXAMPLES = 5

RULES_SQL = """
SELECT rule_id, version, log_threshold, review_threshold, priority_threshold,
       appeal_window_days, effective_from, effective_to
FROM integrity_rule
"""

REPORTS_SQL = """
SELECT r.similarity_report_id, r.rule_id, r.raw_score, r.quoted_score, r.template_score,
       f.band, f.outcome, f.dismissal_reason
FROM similarity_report r
LEFT JOIN v_flag f ON f.similarity_report_id = r.similarity_report_id
ORDER BY r.similarity_report_id
"""

# Each case with the learner it concerns and the learner's department and the assessment's instructor.
ASSIGNMENTS_SQL = """
WITH case_context AS (
    SELECT c.case_id, l.learner_id, l.department AS learner_department, a.instructor_id
    FROM integrity_case c
    JOIN similarity_report r ON r.similarity_report_id = c.similarity_report_id
    JOIN submission s ON s.submission_id = r.submission_id
    JOIN learner l ON l.learner_id = s.learner_id
    JOIN assessment a ON a.assessment_id = s.assessment_id
)
SELECT cr.case_id, cr.reviewer_id, rv.role, rv.department AS reviewer_department,
       cc.learner_department, cc.instructor_id,
       EXISTS (SELECT 1 FROM case_reviewer earlier
               JOIN case_context other ON other.case_id = earlier.case_id
               WHERE earlier.reviewer_id = cr.reviewer_id AND other.learner_id = cc.learner_id
                 AND earlier.case_id <> cr.case_id
                 AND (earlier.assigned_at, earlier.case_id) < (cr.assigned_at, cr.case_id))
           AS reviewed_learner_before
FROM case_reviewer cr
JOIN case_context cc ON cc.case_id = cr.case_id
JOIN reviewer rv ON rv.reviewer_id = cr.reviewer_id
ORDER BY cr.case_id, cr.reviewer_id
"""

# Independent recount, written from the four conflict rules alone (no Python, no auditor code).
# A row is a conflict when the reviewer's role is not instructor/academic_reviewer, teaches the
# assessment, is in the learner's department, or was assigned an earlier case of the same learner.
INDEPENDENT_CONFLICTS_SQL = """
WITH case_learner AS (
    SELECT c.case_id, s.learner_id, l.department AS learner_department, a.instructor_id
    FROM integrity_case c
    JOIN similarity_report r ON r.similarity_report_id = c.similarity_report_id
    JOIN submission s ON s.submission_id = r.submission_id
    JOIN learner l ON l.learner_id = s.learner_id
    JOIN assessment a ON a.assessment_id = s.assessment_id
)
SELECT cr.case_id, cr.reviewer_id
FROM case_reviewer cr
JOIN case_learner cl ON cl.case_id = cr.case_id
JOIN reviewer rv ON rv.reviewer_id = cr.reviewer_id
WHERE rv.role NOT IN ('instructor', 'academic_reviewer')
   OR cl.instructor_id = cr.reviewer_id
   OR rv.department = cl.learner_department
   OR EXISTS (SELECT 1
              FROM case_reviewer earlier
              JOIN case_learner other ON other.case_id = earlier.case_id
              WHERE earlier.reviewer_id = cr.reviewer_id
                AND other.learner_id = cl.learner_id
                AND earlier.case_id <> cr.case_id
                AND (earlier.assigned_at, earlier.case_id) < (cr.assigned_at, cr.case_id))
"""

AUDITOR_ISSUE = "REVIEWER_CONFLICT"


def _rows(con: psycopg.Connection[Any], sql: str) -> list[Row]:
    return con.cursor(row_factory=dict_row).execute(sql).fetchall()


def _view_triage(row: Row) -> Triage | None:
    """What v_flag says about a report: None when the view has no row (not a flag)."""
    if row["outcome"] is None:
        return None
    dismissal = row["dismissal_reason"]
    return Triage(
        is_flag=True,
        band=Band(row["band"]),
        opens_case=row["outcome"] == "case_opened",
        dismissal_reason=DismissalReason(dismissal) if dismissal else None,
    )


def _lower_inclusive_band(score: Any, rule: Rule) -> Band:
    """Band by explicit lower-inclusive comparisons: a score equal to a threshold is in that band.

    Written here, apart from rules.triage.band_for, so a flipped comparison there is caught.
    """
    gates = (
        (rule.priority_threshold, Band.PRIORITY_REVIEW),
        (rule.review_threshold, Band.REVIEW),
        (rule.log_threshold, Band.LOG_ONLY),
    )
    for gate, band in gates:
        if score >= gate:
            return band
    return Band.NO_ACTION


def _boundary_problem(
    report_id: str, scores: Scores, rule: Rule, python: Triage, view: Triage | None
) -> str | None:
    """Problem text when a score sits on a threshold and a band is not the lower-inclusive one."""
    thresholds = {rule.log_threshold, rule.review_threshold, rule.priority_threshold}
    if scores.raw not in thresholds and scores.adjusted not in thresholds:
        return None
    # The band is decided by the raw score below the review gate, by the adjusted score above it.
    decisive = scores.raw if scores.raw < rule.review_threshold else scores.adjusted
    expected = _lower_inclusive_band(decisive, rule)
    if python.band == expected and (view is None or view.band == expected):
        return None
    view_text = f", v_flag {view.band}" if view is not None else ""
    return (
        f"{report_id}: boundary score {decisive} on a threshold, lower-inclusive band {expected}"
        f" but python {python.band}{view_text}"
    )


def flag_agreement(con: psycopg.Connection[Any]) -> dict[str, Any]:
    """Every similarity report: Python triage equals the v_flag row (or no flag), and boundaries hold."""
    rules = {row["rule_id"]: Rule.model_validate(row) for row in _rows(con, RULES_SQL)}
    problems = []
    for row in _rows(con, REPORTS_SQL):
        rule = rules[row["rule_id"]]
        scores = Scores(row["raw_score"], row["quoted_score"], row["template_score"])
        expected = triage(scores, rule)
        actual = _view_triage(row)
        if actual is None:
            if expected.is_flag:
                problems.append(f"{row['similarity_report_id']}: python flags it, v_flag does not")
        elif actual != expected:
            problems.append(f"{row['similarity_report_id']}: python {expected} but v_flag {actual}")
        boundary = _boundary_problem(row["similarity_report_id"], scores, rule, expected, actual)
        if boundary:
            problems.append(boundary)
    return _result(problems)


def _result(problems: list[str]) -> dict[str, Any]:
    """Total count plus the first few examples, enough to read without flooding the output."""
    return {"violations": len(problems), "examples": problems[:MAX_EXAMPLES]}


def _assignment_facts(row: Row) -> ConflictFacts:
    """Facts about one assignment as of the moment it was made (not the case's current state)."""
    return ConflictFacts(
        reviewer_id=row["reviewer_id"],
        reviewer_role=Role(row["role"]),
        reviewer_department=row["reviewer_department"],
        learner_department=row["learner_department"],
        assessment_instructor_id=row["instructor_id"],
        reviewed_learner_before=row["reviewed_learner_before"],
        on_case=False,  # the row itself is the assignment: not a conflict with its own case
        decided_case=False,
    )


def _rule_conflicts(con: psycopg.Connection[Any]) -> dict[Assignment, list[str]]:
    """Python conflict rules: each assignment with at least one conflict, and its codes."""
    found = {}
    for row in _rows(con, ASSIGNMENTS_SQL):
        codes = [str(reason.code) for reason in conflict_reasons(_assignment_facts(row))]
        if codes:
            found[(row["case_id"], row["reviewer_id"])] = codes
    return found


def _auditor_conflicts(con: psycopg.Connection[Any]) -> set[Assignment]:
    """The auditor's REVIEWER_CONFLICT findings (its own SQL, which excludes recused rows)."""
    return {(f.case_id, f.entity_id) for f in audit(con) if f.issue_type == AUDITOR_ISSUE}


def _independent_conflicts(con: psycopg.Connection[Any]) -> set[Assignment]:
    """The independent SQL recount: each assignment with at least one of the four conflicts."""
    return {(row["case_id"], row["reviewer_id"]) for row in _rows(con, INDEPENDENT_CONFLICTS_SQL)}


def _membership(assignment: Assignment, sets: dict[str, set[Assignment]]) -> str:
    """'CAS/REV: rule yes, auditor no, sql yes' for one assignment across the three derivations."""
    flags = ", ".join(f"{name} {'yes' if assignment in s else 'no'}" for name, s in sets.items())
    return f"{assignment[0]}/{assignment[1]}: {flags}"


def reviewer_conflict_agreement(con: psycopg.Connection[Any]) -> dict[str, Any]:
    """Three derivations of the reviewer conflicts must flag the same case_reviewer rows.

    `violations` counts rows that not all three flag or that all three flag not (any pair differs).
    `expected_violations` counts rows all three agree are conflicts: the injected or real flags.
    The `*_flagged` sizes and `only_in_*` counts (flagged by that derivation alone) are reported too.
    """
    rule_codes = _rule_conflicts(con)
    sets: dict[str, set[Assignment]] = {
        "rule": set(rule_codes),
        "auditor": _auditor_conflicts(con),
        "sql": _independent_conflicts(con),
    }
    rule, auditor, sql = sets["rule"], sets["auditor"], sets["sql"]
    agreed = rule & auditor & sql
    disputed = (rule | auditor | sql) - agreed
    only = {
        name: s - set().union(*(o for n, o in sets.items() if n != name))
        for name, s in sets.items()
    }
    return {
        "violations": len(disputed),
        "examples": [_membership(a, sets) for a in sorted(disputed)][:MAX_EXAMPLES],
        "expected_violations": len(agreed),
        "expected_examples": [
            f"{c}/{r}: " + ", ".join(rule_codes[(c, r)]) for c, r in sorted(agreed)
        ][:MAX_EXAMPLES],
        "rule_flagged": len(rule),
        "auditor_flagged": len(auditor),
        "sql_flagged": len(sql),
        "only_in_rule": len(only["rule"]),
        "only_in_auditor": len(only["auditor"]),
        "only_in_sql": len(only["sql"]),
    }


CHECKS = (
    (
        "flag_agreement",
        "Python triage with each report's rule matches the v_flag view (flag, band, case, dismissal), "
        "and scores on a threshold get the lower-inclusive band",
        flag_agreement,
    ),
    (
        "reviewer_conflict_rule_vs_auditor_agreement",
        "Python rules, the auditor SQL and an independent SQL recount flag the same assignments; "
        "this checks the implementations agree, it does not prove any is right",
        reviewer_conflict_agreement,
    ),
)


def run_agreement_checks(con: psycopg.Connection[Any]) -> list[dict[str, Any]]:
    """Run both checks: name, description, then each check's counts and examples."""
    return [
        {"name": name, "description": description, **check(con)}
        for name, description, check in CHECKS
    ]
