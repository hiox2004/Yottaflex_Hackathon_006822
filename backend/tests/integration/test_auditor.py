# ruff: noqa: E501  (SQL fixtures read better unwrapped)
"""Auditor: each detector finds its injected case and ignores its decoy (a legitimate near-miss)."""

import psycopg

from integrity.auditor import audit

CASE_1 = "CAS-2026-000001"
DECISION = f"INSERT INTO decision VALUES ('DEC-{CASE_1}-01', '{CASE_1}', {{reviewer}}, '{{outcome}}', 'rationale', '2026-02-03 09:00Z')"
EVENT = "INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at) VALUES "
APPEAL = f"INSERT INTO appeal VALUES ('APL-{CASE_1}-01', '{CASE_1}', 'DEC-{CASE_1}-01', 'grounds', '2026-02-04Z', 'REV-000003', NULL, {{reviewer}}, 'upheld', 'ok', '2026-02-10Z')"
CLOSE = EVENT + f"('{CASE_1}', 'case_closed', 'appeal_decided', 'closed', '2026-03-01Z')"


def add_case(con: psycopg.Connection, n: int, learner: str, reviewer: str) -> str:
    """Add case n for a learner (new submission and report), assigned to `reviewer` at day n."""
    con.execute(
        "INSERT INTO learner VALUES ('LRN-000002', 'Other Learner', 'Maths', 2025) ON CONFLICT DO NOTHING"
    )
    sub, case = f"SUB-2026-{n:06d}", f"CAS-2026-{n:06d}"
    con.execute(
        f"INSERT INTO submission VALUES ('{sub}', '{learner}', 'ASM-000001', {n}, '2026-01-30 10:00Z', 900);"
        f"INSERT INTO similarity_report VALUES ('SIM-{sub}-01', '{sub}', 'INT-2026-000001', 0.900, 0, 0, DEFAULT, '2026-01-30 11:00Z');"
        f"INSERT INTO integrity_case VALUES ('{case}', 'SIM-{sub}-01', '2026-01-31 10:00Z');"
        f"INSERT INTO case_reviewer VALUES ('{case}', '{reviewer}', 'primary', '2026-02-{n:02d}Z', 'REV-000003')"
    )
    return case


def found(con: psycopg.Connection, issue: str) -> set[tuple[str, str]]:
    return {(f.case_id, f.entity_id) for f in audit(con) if f.issue_type == issue}


def test_clean_fixture_has_no_findings(con: psycopg.Connection) -> None:
    assert audit(con) == []


def test_g1_flags_no_human_or_unassigned_reviewer_but_not_an_assigned_one(
    con: psycopg.Connection,
) -> None:
    con.execute(DECISION.format(reviewer="'REV-000002'", outcome="violation_confirmed"))  # decoy
    assert found(con, "AUTO_GUILT_WITHOUT_REVIEW") == set()
    con.execute(
        f"INSERT INTO decision VALUES ('DEC-{CASE_1}-02', '{CASE_1}', NULL, 'violation_confirmed', 'auto', '2026-02-04Z')"
    )
    con.execute(
        f"INSERT INTO decision VALUES ('DEC-{CASE_1}-03', '{CASE_1}', 'REV-000003', 'violation_confirmed', 'x', '2026-02-05Z')"
    )
    assert found(con, "AUTO_GUILT_WITHOUT_REVIEW") == {
        (CASE_1, f"DEC-{CASE_1}-02"),
        (CASE_1, f"DEC-{CASE_1}-03"),
    }


def test_g2_flags_instructor_department_and_repeat_learner_but_not_a_different_learner(
    con: psycopg.Connection,
) -> None:
    other_learner_case = add_case(
        con, 2, "LRN-000002", "REV-000002"
    )  # decoy: same reviewer, different learner
    assert found(con, "REVIEWER_CONFLICT") == set()
    con.execute(
        f"INSERT INTO case_reviewer VALUES ('{CASE_1}', 'REV-000001', 'secondary', '2026-02-03Z', 'REV-000003')"
    )
    con.execute(
        "INSERT INTO reviewer VALUES ('REV-000004', 'Bea Biologist', 'academic_reviewer', 'Biology')"
    )
    con.execute(
        f"INSERT INTO case_reviewer VALUES ('{CASE_1}', 'REV-000004', 'secondary', '2026-02-03Z', 'REV-000003')"
    )
    repeat = add_case(
        con, 3, "LRN-000001", "REV-000002"
    )  # REV-000002 already reviewed case 1 of this learner
    assert other_learner_case not in {c for c, _ in found(con, "REVIEWER_CONFLICT")}
    assert found(con, "REVIEWER_CONFLICT") == {
        (CASE_1, "REV-000001"),
        (CASE_1, "REV-000004"),
        (repeat, "REV-000002"),
    }


def test_g3_flags_evidence_after_decision_unless_the_case_was_reopened(
    con: psycopg.Connection,
) -> None:
    con.execute(DECISION.format(reviewer="'REV-000002'", outcome="no_violation"))
    con.execute(EVENT + f"('{CASE_1}', 'case_reopened', 'decided', 'under_review', '2026-02-04Z')")
    con.execute(
        f"INSERT INTO evidence_item VALUES ('EVD-{CASE_1}-002', '{CASE_1}', 'learner_statement', 'after reopen', '2026-02-05Z', NULL)"
    )  # decoy
    assert found(con, "EVIDENCE_AFTER_DECISION_NO_HISTORY") == set()
    con.execute(
        f"INSERT INTO decision VALUES ('DEC-{CASE_1}-02', '{CASE_1}', 'REV-000002', 'no_violation', 'again', '2026-02-06Z');"
        f"INSERT INTO evidence_item VALUES ('EVD-{CASE_1}-003', '{CASE_1}', 'learner_statement', 'sneaked in', '2026-02-07Z', NULL)"
    )
    assert found(con, "EVIDENCE_AFTER_DECISION_NO_HISTORY") == {(CASE_1, f"EVD-{CASE_1}-003")}


def test_g4_flags_closure_after_missing_or_non_independent_appeal_review(
    con: psycopg.Connection,
) -> None:
    con.execute(
        "INSERT INTO reviewer VALUES ('REV-000005', 'Max Maths', 'academic_reviewer', 'Maths')"
    )
    con.execute(DECISION.format(reviewer="'REV-000002'", outcome="violation_confirmed"))
    con.execute(APPEAL.format(reviewer="'REV-000005'"))  # decoy: independent reviewer
    con.execute(CLOSE)
    assert found(con, "APPEAL_CLOSED_NO_INDEPENDENT_REVIEW") == set()
    case_2 = add_case(con, 2, "LRN-000002", "REV-000005")
    con.execute(
        f"INSERT INTO decision VALUES ('DEC-{case_2}-01', '{case_2}', 'REV-000005', 'violation_confirmed', 'x', '2026-02-03Z');"
        f"INSERT INTO appeal VALUES ('APL-{case_2}-01', '{case_2}', 'DEC-{case_2}-01', 'g', '2026-02-04Z', 'REV-000003', NULL, 'REV-000005', 'upheld', 'ok', '2026-02-10Z');"
        + EVENT
        + f"('{case_2}', 'case_closed', 'appeal_decided', 'closed', '2026-03-01Z')"
    )
    assert found(con, "APPEAL_CLOSED_NO_INDEPENDENT_REVIEW") == {(case_2, f"APL-{case_2}-01")}


RECUSE = (
    "INSERT INTO case_event (case_id, event_type, occurred_at, actor_id, ref_id, reason) VALUES "
    "('{case}', 'reviewer_recused', '2026-02-04Z', '{reviewer}', '{reviewer}', 'conflict of interest')"
)


def test_recused_conflicted_reviewer_is_not_reported(con: psycopg.Connection) -> None:
    con.execute(
        f"INSERT INTO case_reviewer VALUES ('{CASE_1}', 'REV-000001', 'secondary', '2026-02-03Z', 'REV-000003')"
    )
    assert found(con, "REVIEWER_CONFLICT") == {(CASE_1, "REV-000001")}
    con.execute(RECUSE.format(case=CASE_1, reviewer="REV-000001"))
    assert found(con, "REVIEWER_CONFLICT") == set()


def test_recusal_from_an_earlier_case_removes_the_repeat_conflict(con: psycopg.Connection) -> None:
    repeat = add_case(con, 3, "LRN-000001", "REV-000002")
    assert found(con, "REVIEWER_CONFLICT") == {(repeat, "REV-000002")}
    con.execute(RECUSE.format(case=CASE_1, reviewer="REV-000002"))
    assert found(con, "REVIEWER_CONFLICT") == set()


def test_decision_before_a_later_recusal_is_not_flagged(con: psycopg.Connection) -> None:
    con.execute(DECISION.format(reviewer="'REV-000002'", outcome="violation_confirmed"))
    con.execute(RECUSE.format(case=CASE_1, reviewer="REV-000002"))
    assert found(con, "AUTO_GUILT_WITHOUT_REVIEW") == set()


def test_audit_can_be_limited_to_one_case(con: psycopg.Connection) -> None:
    con.execute(
        f"INSERT INTO case_reviewer VALUES ('{CASE_1}', 'REV-000001', 'secondary', '2026-02-03Z', 'REV-000003')"
    )
    assert [f.case_id for f in audit(con, CASE_1)] == [CASE_1]
    assert audit(con, "CAS-2026-000999") == []
