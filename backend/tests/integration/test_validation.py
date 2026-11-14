"""Validator: the clean fixture passes, each check class catches its violation, anomalies still pass."""

# ruff: noqa: E501  (SQL fixtures read better unwrapped)

import psycopg
import pytest

from integrity.validation import render_markdown, run_checks, summarize

OTHER_REPORT = """
INSERT INTO submission VALUES ('SUB-2026-000002', 'LRN-000001', 'ASM-000001', 2, '2026-01-30 11:00Z', 900);
INSERT INTO similarity_report VALUES ('SIM-SUB-2026-000002-01', 'SUB-2026-000002', 'INT-2026-000001',
                                      {raw}, 0.000, 0.000, DEFAULT, '2026-01-30 11:05Z');
"""
SECOND_CASE = (
    OTHER_REPORT.format(raw="0.850")
    + """
INSERT INTO integrity_case VALUES ('CAS-2026-000002', 'SIM-SUB-2026-000002-01', '2026-01-31 10:00Z');
INSERT INTO evidence_item VALUES ('EVD-CAS-2026-000002-001', 'CAS-2026-000002', 'matched_passage',
                                  'Other case passage', '2026-02-02 10:00Z', NULL);
INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at)
  VALUES ('CAS-2026-000002', 'case_opened', NULL, 'open', '2026-01-31 10:00Z');
"""
)
DECISION = """
INSERT INTO decision VALUES ('DEC-CAS-2026-000001-01', 'CAS-2026-000001', 'REV-000002', 'violation_confirmed',
                             'Clear copying', '2026-02-03 09:00Z');
"""
EVENT = "INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at, ref_id) VALUES "

VIOLATIONS = {
    "report_per_submission": "INSERT INTO submission VALUES ('SUB-2026-000002', 'LRN-000001', 'ASM-000001', 2, now(), 5)",
    "rule_in_force": OTHER_REPORT.format(raw="0.100").replace("2026-01-30 11:00Z", "2025-12-01 00:00Z"),
    "rules_do_not_overlap": "INSERT INTO integrity_rule VALUES ('INT-2026-000002', 'v2', 2, .3, .6, .8, 14, '2026-02-01Z', NULL)",
    "triage_reconciliation": OTHER_REPORT.format(raw="0.900"),
    "assessment_instructor_role": "INSERT INTO assessment VALUES ('ASM-000002', 'T', 'essay', 'Law', 'REV-000002', now())",
    "id_sequences": "INSERT INTO evidence_item VALUES ('EVD-CAS-2026-000001-003', 'CAS-2026-000001', 'source_reference', 'x', '2026-02-03Z', NULL)",
    "date_order": "INSERT INTO evidence_item VALUES ('EVD-CAS-2026-000001-002', 'CAS-2026-000001', 'source_reference', 'x', '2026-01-01Z', NULL)",
    "case_opened_event": EVENT + "('CAS-2026-000001', 'case_opened', NULL, 'open', '2026-01-31 09:00Z', NULL)",
    "transition_pairs": EVENT + "('CAS-2026-000001', 'case_closed', 'under_review', 'closed', '2026-02-05Z', NULL)",
    "transition_chain": EVENT + "('CAS-2026-000001', 'case_reopened', 'decided', 'under_review', '2026-02-05Z', NULL)",
    "event_references": EVENT + "('CAS-2026-000001', 'evidence_added', NULL, NULL, '2026-02-05Z', 'EVD-NOPE')",
    "status_matches_rows": EVENT + "('CAS-2026-000001', 'decision_recorded', 'under_review', 'decided', '2026-02-05Z', NULL)",
    "cited_evidence_same_case": SECOND_CASE + DECISION + "INSERT INTO decision_evidence VALUES ('DEC-CAS-2026-000001-01', 'EVD-CAS-2026-000002-001')",
    "appeal_decision_same_case": SECOND_CASE + DECISION + "INSERT INTO appeal (appeal_id, case_id, decision_id, grounds, filed_at, filed_by) VALUES ('APL-CAS-2026-000002-01', 'CAS-2026-000002', 'DEC-CAS-2026-000001-01', 'g', '2026-02-10Z', 'REV-000003')",
    "duplicate_evidence": "INSERT INTO evidence_item VALUES ('EVD-CAS-2026-000001-002', 'CAS-2026-000001', 'matched_passage', 'Paragraph 3 matches a web page', '2026-02-03Z', NULL)",
}  # fmt: skip

# G1 (no human decided), G2 (instructor assigned to a case), G3 (evidence after the decision, no event):
# due-process violations, but well-formed data, so the validator must stay green.
ANOMALIES = (
    """
INSERT INTO decision VALUES ('DEC-CAS-2026-000001-01', 'CAS-2026-000001', NULL, 'violation_confirmed',
                             'Score above threshold', '2026-02-03 09:00Z');
INSERT INTO case_reviewer VALUES ('CAS-2026-000001', 'REV-000001', 'secondary', '2026-02-03 08:00Z', 'REV-000003');
INSERT INTO evidence_item VALUES ('EVD-CAS-2026-000001-002', 'CAS-2026-000001', 'learner_statement',
                                  'Late statement', '2026-02-05 09:00Z', 'REV-000002');
"""
    + EVENT
    + "('CAS-2026-000001', 'decision_recorded', 'under_review', 'decided', '2026-02-03 09:00Z', 'DEC-CAS-2026-000001-01')"
)


def failing_checks(con: psycopg.Connection) -> set[str]:
    return {v.check for v in run_checks(con)}


def test_clean_fixture_has_no_violations(con: psycopg.Connection) -> None:
    assert run_checks(con) == []


@pytest.mark.parametrize("check", VIOLATIONS)
def test_each_check_catches_its_violation(con: psycopg.Connection, check: str) -> None:
    con.execute(VIOLATIONS[check])
    assert check in failing_checks(con)


def test_labelled_anomalies_are_valid_data(con: psycopg.Connection) -> None:
    con.execute(ANOMALIES)
    assert run_checks(con) == []


def test_summary_is_deterministic_and_renders(con: psycopg.Connection) -> None:
    summary = summarize(con)
    assert summary["violations"] == 0
    assert summary["counts"]["integrity_case"] == 1
    assert summary["distributions"]["flags_by_band"] == {"review": 1}
    assert render_markdown(summary) == render_markdown(summarize(con))
