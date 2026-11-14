"""Lifecycle replay: the seed replays cleanly, bad appended events are caught, tables agree."""

import psycopg

from integrity.validation.replay import (
    lifecycle_replay,
    run_replay_checks,
    transition_table_matches,
)

# case_event is append-only, so each corruption is an extra event after the seed's last one.
LATER = "'2026-02-05 09:00Z'"


def _append(con: psycopg.Connection, event_type: str, frm: str | None, to: str | None) -> None:
    con.execute(
        "INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at) "
        f"VALUES ('CAS-2026-000001', %s, %s, %s, {LATER})",
        (event_type, frm, to),
    )


def test_seed_fixture_replays_without_violations(con: psycopg.Connection) -> None:
    assert lifecycle_replay(con) == (0, [])
    assert transition_table_matches() == (0, [])
    assert all(check["violations"] == 0 for check in run_replay_checks(con))


def test_same_status_recording_is_the_same_transition(con: psycopg.Connection) -> None:
    _append(con, "evidence_added", "under_review", "under_review")
    assert lifecycle_replay(con) == (0, [])


def test_event_the_rules_do_not_allow_is_detected(con: psycopg.Connection) -> None:
    _append(con, "case_closed", "under_review", "closed")
    count, examples = lifecycle_replay(con)
    assert count == 1
    assert "case_closed is not allowed while the case is under_review" in examples[0]


def test_recusal_is_an_allowed_self_loop_under_review(con: psycopg.Connection) -> None:
    con.execute(
        "INSERT INTO case_event (case_id, event_type, occurred_at, actor_id, ref_id, reason) "
        "VALUES ('CAS-2026-000001', 'reviewer_recused', "
        f"{LATER}, 'REV-000002', 'REV-000002', 'conflict')"
    )
    assert lifecycle_replay(con) == (0, [])
    assert transition_table_matches() == (0, [])


def test_broken_chain_is_detected(con: psycopg.Connection) -> None:
    _append(con, "decision_recorded", "decided", "decided")
    count, examples = lifecycle_replay(con)
    assert count == 1
    assert "chain broken: from decided but the case was under_review" in examples[0]
