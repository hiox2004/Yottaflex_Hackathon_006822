"""Read endpoints return the contract's shapes; actors and missing cases get the error envelope."""

from tests.api.conftest import Api

CASE_DETAIL_KEYS = {
    "case_id",
    "status",
    "opened_at",
    "closed_at",
    "learner",
    "assessment",
    "flag",
    "reviewers",
    "evidence",
    "decisions",
    "appeal",
    "effective_outcome",
    "allowed_actions",
    "action_checks",
}
QUEUE_ROW_KEYS = {
    "case_id",
    "learner_id",
    "learner_name",
    "assessment_title",
    "adjusted_score",
    "band",
    "status",
    "assignee_ids",
    "opened_at",
    "needs_my_action",
}
COUNT_KEYS = {"needs_me", "under_review", "awaiting_appeal", "decided", "closed", "dismissed_flags"}
# Same wording as frontend/src/labels.ts (OUTCOME_LABEL, EVIDENCE_LABEL).
OUTCOME_WORDS = {
    "no_violation": "No violation found",
    "violation_confirmed": "Violation confirmed by reviewer",
    "inconclusive": "Inconclusive",
}
KIND_WORDS = {
    "matched_passage": "Matched passage",
    "source_reference": "Source reference",
    "template_match": "Template match",
    "quote_citation": "Quote with citation",
    "learner_statement": "Learner statement",
}


def test_queue_has_rows_totals_and_counts_over_all_cases(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    page = api.get("/queue?limit=5", admin)
    assert page["total"] == 30
    assert len(page["items"]) == 5
    assert set(page["items"][0]) == QUEUE_ROW_KEYS
    assert set(page["counts"]) == COUNT_KEYS
    assert page["counts"]["dismissed_flags"] == 70
    filtered = api.get("/queue?status=open", admin)
    assert filtered["counts"] == page["counts"]  # counts ignore the filters


def test_case_detail_has_the_contract_keys_and_a_plain_explanation(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    detail = api.get(f"/cases/{api.first_case(admin)}", admin)
    assert set(detail) == CASE_DETAIL_KEYS
    assert [s["step"] for s in detail["flag"]["explanation"]] == [
        "raw_score",
        "exclusions",
        "adjusted_score",
        "band",
        "outcome",
    ]
    assert {c["action"] for c in detail["action_checks"]} >= set(detail["allowed_actions"])
    assert all(c["reasons"] for c in detail["action_checks"] if not c["allowed"])


def test_unknown_actor_and_missing_case_use_the_error_envelope(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    assert api.get("/queue", "REV-999999")["error"]["code"] == "UNKNOWN_ACTOR"
    assert api.client.get("/api/queue").status_code == 401
    assert api.get("/cases/CAS-2026-999999", admin)["error"]["code"] == "NOT_FOUND"
    assert api.client.get("/api/queue?limit=500", headers={"X-Actor-Id": admin}).status_code == 422


def test_dismissed_flags_and_rules_and_timeline(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    flags = api.get("/flags?limit=3", admin)
    assert flags["total"] == 70
    assert len(flags["items"]) == 3
    assert [r["version"] for r in api.get("/rules", admin)] == [1, 2]
    case_id = api.first_case(admin)
    assert api.get(f"/cases/{case_id}/timeline", admin)[0]["event_type"] == "case_opened"


def test_timeline_details_say_what_happened_for_a_decision_and_evidence(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    for row in api.get("/queue?limit=200", admin)["items"]:
        detail = api.get(f"/cases/{row['case_id']}", admin)
        if detail["decisions"] and detail["evidence"]:
            break
    else:
        raise AssertionError("seed has no case with both a decision and evidence")
    timeline = api.get(f"/cases/{detail['case_id']}/timeline", admin)
    decision = detail["decisions"][0]
    evidence = detail["evidence"][0]
    by_ref = {e["ref_id"]: e for e in timeline}
    assert by_ref[decision["decision_id"]]["detail"] == OUTCOME_WORDS[decision["outcome"]]
    assert by_ref[evidence["evidence_id"]]["detail"] == (
        f"{KIND_WORDS[evidence['kind']]}: {evidence['description'][:120]}"
    )


def test_eligible_reviewers_list_everyone_and_mark_roles_that_cannot_review(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    rows = api.get(f"/cases/{api.first_case(admin)}/eligible-reviewers", admin)
    assert len(rows) == 64
    by_id = {r["reviewer_id"]: r for r in rows}
    assert by_id[admin]["eligible"] is False
    assert by_id[admin]["reasons"][0]["code"] == "ROLE_CANNOT_REVIEW"
    assert any(r["eligible"] for r in rows)
