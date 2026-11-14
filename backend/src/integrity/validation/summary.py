"""Validation summary: counts, per-check results and distribution tables, plus the markdown writer."""

# Long SQL lines read better unwrapped; S608: only module constants are interpolated, never input.
# ruff: noqa: E501, S608

from typing import Any

import psycopg

from integrity.validation.agreement import run_agreement_checks
from integrity.validation.checks import CHECKS, Violation, run_checks
from integrity.validation.replay import run_replay_checks
from integrity.validation.sanity import run_sanity_checks

TABLES = (
    "reviewer", "learner", "assessment", "integrity_rule", "submission", "similarity_report",
    "integrity_case", "case_reviewer", "evidence_item", "decision", "decision_evidence", "appeal",
    "case_event",
)  # fmt: skip

# name -> SQL returning (label, count) rows with a total ORDER BY.
DISTRIBUTIONS = {
    "raw_score_by_tenth": """SELECT to_char(floor(raw_score * 10) / 10, 'FM0.0') AS bucket, count(*)
        FROM similarity_report GROUP BY 1 ORDER BY 1""",
    "adjusted_score_by_tenth": """SELECT to_char(floor(adjusted_score * 10) / 10, 'FM0.0') AS bucket, count(*)
        FROM similarity_report GROUP BY 1 ORDER BY 1""",
    "flags_by_band": "SELECT band, count(*) FROM v_flag GROUP BY 1 ORDER BY 1",
    "flag_outcomes": """SELECT outcome || COALESCE(' (' || dismissal_reason || ')', ''), count(*)
        FROM v_flag GROUP BY 1 ORDER BY 1""",
    "cases_by_status": "SELECT status, count(*) FROM v_case_queue GROUP BY 1 ORDER BY 1",
    "cases_by_band": "SELECT band, count(*) FROM v_case_queue GROUP BY 1 ORDER BY 1",
    "decisions_by_outcome": "SELECT outcome, count(*) FROM decision GROUP BY 1 ORDER BY 1",
    "appeals_by_outcome": "SELECT COALESCE(outcome, 'pending'), count(*) FROM appeal GROUP BY 1 ORDER BY 1",
    "effective_outcomes": """SELECT COALESCE(effective_outcome, 'undecided'), count(*)
        FROM v_case_queue GROUP BY 1 ORDER BY 1""",
    "reviewers_per_case": """SELECT n::text, count(*) FROM (SELECT c.case_id, count(r.reviewer_id) AS n
        FROM integrity_case c LEFT JOIN case_reviewer r USING (case_id) GROUP BY 1) t GROUP BY 1 ORDER BY 1""",
    "evidence_per_case": """SELECT n::text, count(*) FROM (SELECT c.case_id, count(x.evidence_id) AS n
        FROM integrity_case c LEFT JOIN evidence_item x USING (case_id) GROUP BY 1) t GROUP BY 1 ORDER BY 1""",
    "staff_by_role": "SELECT role, count(*) FROM reviewer GROUP BY 1 ORDER BY 1",
    "reports_by_rule": "SELECT rule_id, count(*) FROM similarity_report GROUP BY 1 ORDER BY 1",
    # Reports whose adjusted score sits on a band edge: proves boundary handling is exercised (L1e).
    "boundary_adjusted_scores": """SELECT to_char(adjusted_score, 'FM0.000'), count(*) FROM similarity_report
        WHERE adjusted_score IN (0.299, 0.300, 0.599, 0.600, 0.799, 0.800) GROUP BY 1 ORDER BY 1""",
}  # fmt: skip


def _extra_checks(con: psycopg.Connection[Any]) -> list[dict[str, Any]]:
    """Replay and agreement results, shaped like the SQL checks (name, description, violations)."""
    return run_replay_checks(con) + run_agreement_checks(con)


def summarize(
    con: psycopg.Connection[Any],
    violations: list[Violation] | None = None,
    scale: str | None = None,
) -> dict[str, Any]:
    """Row counts, per-check results and distribution tables; pass `violations` to reuse a run.

    Sanity checks come first (they fail on an empty or wrong-sized database, where the row checks
    pass vacuously). The top-level `violations` counts unexpected failures across every check,
    so 0 means clean.
    """
    violations = run_checks(con) if violations is None else violations
    counts = {t: int(con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]) for t in TABLES}  # type: ignore[index]
    checks: list[dict[str, Any]] = run_sanity_checks(con, scale)
    checks += [
        {
            "name": c.name,
            "description": c.description,
            "violations": sum(1 for v in violations if v.check == c.name),
        }
        for c in CHECKS
    ]
    checks += _extra_checks(con)
    distributions = {
        name: {str(label): int(n) for label, n in con.execute(sql)}
        for name, sql in DISTRIBUTIONS.items()
    }
    counts["flags"] = sum(distributions["flags_by_band"].values())
    return {
        "counts": counts,
        "checks": checks,
        "violations": sum(int(c["violations"]) for c in checks),
        "distributions": distributions,
    }


def failing_checks(summary: dict[str, Any]) -> list[str]:
    """Names to report on a failed run: checks with violations, or every check if none ran at all."""
    if not summary["checks"]:
        return ["no checks ran"]
    return [c["name"] for c in summary["checks"] if c["violations"]]


def render_markdown(summary: dict[str, Any]) -> str:
    """Render a summary as the validation_summary.md text (no timestamps, so reruns are identical)."""
    lines = ["# Validation summary", ""]
    verdict = "PASS" if summary["violations"] == 0 else f"FAIL ({summary['violations']} violations)"
    lines += [f"Result: **{verdict}**", "", "## Row counts", "", "| table | rows |", "|---|---|"]
    lines += [f"| {name} | {n} |" for name, n in summary["counts"].items()]
    lines += ["", "## Checks", "", "| check | violations | rule |", "|---|---|---|"]
    for c in summary["checks"]:
        expected = c.get("expected_violations")
        count = (
            f"{c['violations']} ({expected} agreed by all derivations)"
            if expected
            else c["violations"]
        )
        lines.append(f"| {c['name']} | {count} | {c['description']} |")
    for name, table in summary["distributions"].items():
        lines += ["", f"## {name.replace('_', ' ')}", "", "| value | count |", "|---|---|"]
        lines += [f"| {label} | {n} |" for label, n in table.items()] or ["| (none) | 0 |"]
    lines += [
        "",
        "Limits: the validator proves the data is well formed (keys, joins, dates, reconciliation,"
        " lifecycle). It does not prove due process was followed; the auditor reports that.",
    ]
    return "\n".join(lines) + "\n"
