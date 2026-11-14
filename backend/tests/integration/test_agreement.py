"""Agreement checks: the clean fixture agrees; three derivations of reviewer conflicts agree.

These checks compare implementations, so the tests show they agree on the same facts and fail when
one of them is corrupted. They do not show that any derivation is the right rule.
"""

import importlib

import psycopg
import pytest
from mutation_helpers import unseal

from integrity.auditor import audit
from integrity.models import Band, ConflictCode
from integrity.validation import agreement
from integrity.validation.agreement import (
    flag_agreement,
    reviewer_conflict_agreement,
    run_agreement_checks,
)

# `integrity.rules` re-exports the `triage` function under the module's name,
# so load the module itself.
triage_module = importlib.import_module("integrity.rules.triage")

CONFLICT_CHECK = "reviewer_conflict_rule_vs_auditor_agreement"

# REV-000001 teaches ASM-000001, so assigning them to the case is an instructor conflict.
INSTRUCTOR_ON_CASE = (
    "INSERT INTO case_reviewer VALUES "
    "('CAS-2026-000001', 'REV-000001', 'secondary', '2026-02-01 10:00Z', 'REV-000003')"
)
# REV-000002 is on the case and learner LRN-000001 is in Biology: moving REV-000002 into Biology
# creates a SAME_DEPARTMENT conflict on an assignment that was clean before.
REVIEWER_TO_LEARNER_DEPARTMENT = (
    "UPDATE reviewer SET department = 'Biology' WHERE reviewer_id = 'REV-000002'"
)
# Raw 0.600 with no exclusions: adjusted 0.600 sits exactly on the review threshold of the fixture.
REPORT_ON_REVIEW_THRESHOLD = (
    "UPDATE similarity_report SET raw_score = 0.600, quoted_score = 0.000, template_score = 0.000 "
    "WHERE similarity_report_id = 'SIM-SUB-2026-000001-01'"
)


def test_clean_fixture_agrees(con: psycopg.Connection) -> None:
    results = {row["name"]: row for row in run_agreement_checks(con)}
    assert results["flag_agreement"]["violations"] == 0
    assert results[CONFLICT_CHECK]["violations"] == 0
    assert results[CONFLICT_CHECK]["rule_flagged"] == 0


def test_reviewer_conflicts_are_the_auditor_findings(con: psycopg.Connection) -> None:
    con.execute(INSTRUCTOR_ON_CASE)
    check = reviewer_conflict_agreement(con)
    found = {
        f"{f.case_id}/{f.entity_id}" for f in audit(con) if f.issue_type == "REVIEWER_CONFLICT"
    }
    assert check["violations"] == 0
    assert check["expected_violations"] == check["rule_flagged"] == check["auditor_flagged"] == 1
    assert check["sql_flagged"] == 1
    assert check["examples"] == []
    assert {example.split(":")[0] for example in check["expected_examples"]} == found
    assert check["expected_examples"][0].endswith("INSTRUCTOR_OF_ASSESSMENT")


def test_new_conflict_moves_all_three_sets_and_still_agrees(con: psycopg.Connection) -> None:
    con.execute(REVIEWER_TO_LEARNER_DEPARTMENT)
    check = reviewer_conflict_agreement(con)
    # Agreement, not correctness: the department change creates the conflict in every derivation.
    assert check["rule_flagged"] == check["auditor_flagged"] == check["sql_flagged"] == 1
    assert check["only_in_rule"] == check["only_in_auditor"] == check["only_in_sql"] == 0
    assert check["violations"] == 0
    assert check["expected_violations"] == 1
    assert check["expected_examples"] == ["CAS-2026-000001/REV-000002: SAME_DEPARTMENT"]


def test_rule_engine_dropping_a_conflict_fails_the_check(
    con: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    con.execute(REVIEWER_TO_LEARNER_DEPARTMENT)
    real = agreement.conflict_reasons

    def ignore_same_department(facts, ignore_on_case=False):  # type: ignore[no-untyped-def]
        return [r for r in real(facts, ignore_on_case) if r.code != ConflictCode.SAME_DEPARTMENT]

    monkeypatch.setattr(agreement, "conflict_reasons", ignore_same_department)
    check = reviewer_conflict_agreement(con)
    assert check["rule_flagged"] == 0
    assert check["auditor_flagged"] == check["sql_flagged"] == 1
    assert check["only_in_auditor"] == check["only_in_sql"] == 0
    assert check["violations"] == 1
    assert check["examples"] == ["CAS-2026-000001/REV-000002: rule no, auditor yes, sql yes"]


def test_boundary_report_on_review_threshold_gets_lower_inclusive_band(
    con: psycopg.Connection,
) -> None:
    unseal(con, "similarity_report")
    con.execute(REPORT_ON_REVIEW_THRESHOLD)
    assert flag_agreement(con)["violations"] == 0


def test_flipped_comparison_fails_the_boundary_assertion(
    con: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    unseal(con, "similarity_report")
    con.execute(REPORT_ON_REVIEW_THRESHOLD)

    def strict_band_for(score, rule):  # type: ignore[no-untyped-def]
        # Wrong on purpose: a score equal to a threshold falls to the band below it.
        if score > rule.priority_threshold:
            return Band.PRIORITY_REVIEW
        if score > rule.review_threshold:
            return Band.REVIEW
        if score > rule.log_threshold:
            return Band.LOG_ONLY
        return Band.NO_ACTION

    monkeypatch.setattr(triage_module, "band_for", strict_band_for)
    check = flag_agreement(con)
    boundary = [example for example in check["examples"] if "boundary" in example]
    assert boundary, check
    assert "lower-inclusive band review" in boundary[0]
