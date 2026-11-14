"""Mutation tests: each corruption of the seeded case must trip the check that owns it, and only that one.

The seed (conftest `con`) is clean. Each test corrupts the scratch copy, asserts the named check
fails, and asserts an unrelated check stays green, so a passing suite shows the checks are not vacuous.
"""

# Long SQL lines read better unwrapped.
# ruff: noqa: E501

import psycopg
import pytest
from mutation_helpers import DECISION_ON_CASE_ONE, OTHER_CASE, failing_counts, unseal
from tests.db_schema import quote, schema_name

from integrity import db
from integrity.dbload import SCHEMA
from integrity.models import Action, Status
from integrity.rules import TRANSITIONS
from integrity.validation import replay
from integrity.validation.checks import run_checks
from integrity.validation.replay import lifecycle_replay, transition_table_matches
from integrity.validation.sanity import run_sanity_checks


def test_deleting_all_events_is_caught(con: psycopg.Connection) -> None:
    # Without its events a case has no status and no case_opened event.
    unseal(con, "case_event")
    con.execute("DELETE FROM case_event")
    found = failing_counts(con)
    assert found["case_opened_event"] == 1
    assert found["status_matches_rows"] == 1
    assert found["report_per_submission"] == 0


def test_illegal_transition_pair_is_caught(con: psycopg.Connection) -> None:
    # reviewer_assigned open -> closed is not a lifecycle transition.
    unseal(con, "case_event")
    con.execute("UPDATE case_event SET to_status = 'closed' WHERE event_type = 'reviewer_assigned'")
    found = failing_counts(con)
    assert found["transition_pairs"] == 1
    assert found["date_order"] == 0
    count, examples = lifecycle_replay(con)
    assert count == 1
    assert "reviewer_assigned recorded open -> closed" in examples[0]


def test_broken_chain_is_caught(con: psycopg.Connection) -> None:
    # A legal pair (decided -> under_review) that starts from a status the case had left.
    con.execute(
        "INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at) "
        "VALUES ('CAS-2026-000001', 'case_reopened', 'decided', 'under_review', '2026-02-05 09:00Z')"
    )
    found = failing_counts(con)
    assert found["transition_chain"] == 1
    assert found["transition_pairs"] == 0


def test_decision_citing_other_case_evidence_is_caught(con: psycopg.Connection) -> None:
    con.execute(OTHER_CASE + DECISION_ON_CASE_ONE)
    con.execute(
        "INSERT INTO decision_evidence VALUES ('DEC-CAS-2026-000001-01', 'EVD-CAS-2026-000002-001')"
    )
    found = failing_counts(con)
    assert found["cited_evidence_same_case"] == 1
    assert found["duplicate_evidence"] == 0


def test_duplicate_evidence_is_caught(con: psycopg.Connection) -> None:
    con.execute(
        "INSERT INTO evidence_item VALUES ('EVD-CAS-2026-000001-002', 'CAS-2026-000001', 'matched_passage', "
        "'Paragraph 3 matches a web page', '2026-02-03 09:00Z', NULL)"
    )
    found = failing_counts(con)
    assert found["duplicate_evidence"] == 1
    assert found["id_sequences"] == 0


def test_event_before_case_opened_is_caught(con: psycopg.Connection) -> None:
    # An evidence event dated before the case existed. ref_id is real, so only the date is wrong.
    con.execute(
        "INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at, ref_id) "
        "VALUES ('CAS-2026-000001', 'evidence_added', NULL, NULL, '2026-01-01 00:00Z', 'EVD-CAS-2026-000001-001')"
    )
    found = failing_counts(con)
    assert found["date_order"] >= 1
    assert found["transition_pairs"] == 0


def test_score_moved_below_review_gate_is_caught(con: psycopg.Connection) -> None:
    # Raw score 0.900 -> 0.500 drops the adjusted score under the review gate, but the case stays.
    # flag_agreement stays green: Python triage and v_flag agree, so only the reconciliation sees it.
    unseal(con, "similarity_report")
    con.execute(
        "UPDATE similarity_report SET raw_score = 0.500 WHERE similarity_report_id = 'SIM-SUB-2026-000001-01'"
    )
    found = failing_counts(con)
    assert found["triage_reconciliation"] == 1
    assert found["rule_in_force"] == 0


@pytest.mark.parametrize(
    "removed",
    [
        pytest.param((Status.UNDER_REVIEW, Action.RECUSE), id="recuse_under_review"),
        pytest.param(
            (Status.APPEAL_REVIEW, Action.ASSIGN_APPEAL_REVIEWER), id="reassign_appeal_review"
        ),
        pytest.param(
            (Status.UNDER_REVIEW, Action.ADD_EVIDENCE),
            id="add_evidence_under_review",
            marks=pytest.mark.xfail(
                strict=False,
                reason="real gap: checks.py and rules collapse every self-loop to '*'; the open -> open "
                "ADD_EVIDENCE row also canonicalises to ('evidence_added', '*', '*'), so removing the "
                "under_review one is hidden",
            ),
        ),
    ],
)
def test_removed_self_loop_is_reported(
    monkeypatch: pytest.MonkeyPatch, con: psycopg.Connection, removed: tuple[Status, Action]
) -> None:
    table = dict(TRANSITIONS)
    del table[removed]
    monkeypatch.setattr(replay, "TRANSITIONS", table)
    count, examples = transition_table_matches()
    assert count >= 1
    assert "only in" in examples[0]
    assert failing_counts(con)["transition_pairs"] == 0


def test_reviewer_event_without_assignment_is_caught(con: psycopg.Connection) -> None:
    # REV-000001 has no case_reviewer row on CAS-2026-000001.
    con.execute(
        "INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at, actor_id, ref_id) "
        "VALUES ('CAS-2026-000001', 'reviewer_assigned', NULL, NULL, '2026-02-05 09:00Z', 'REV-000003', 'REV-000001')"
    )
    found = failing_counts(con)
    assert found["event_references"] == 1
    assert found["date_order"] == 0
    assert found["transition_pairs"] == 0


def test_empty_database_is_not_reported_clean() -> None:
    # Without the seed, run_checks has nothing to complain about and reports no violations. Only the
    # sanity checks say the database is empty: run_sanity_checks returns one dict per check.
    with db.connect() as connection:
        try:
            schema = quote(schema_name())
            connection.execute(f"CREATE SCHEMA {schema}; SET LOCAL search_path TO {schema}")
            connection.execute(SCHEMA.read_text(encoding="utf-8"))
            assert run_checks(connection) == []
            sanity = run_sanity_checks(connection)
            assert sum(int(check["violations"]) for check in sanity) > 0
            assert next(c for c in sanity if c["name"] == "tables_not_empty")["violations"] > 0
        finally:
            connection.rollback()
