"""Write endpoints: the happy path to closure and the four negative scenarios, each rejected."""

from tests.api.conftest import Api

CONFLICT_CODES = {"INSTRUCTOR_OF_ASSESSMENT", "SAME_DEPARTMENT", "REVIEWED_LEARNER_BEFORE"}


def candidates(api: Api, case_id: str, admin: str, purpose: str = "case") -> list[dict]:  # type: ignore[type-arg]
    return api.get(f"/cases/{case_id}/eligible-reviewers?purpose={purpose}", admin)  # type: ignore[return-value]


def free_reviewer(api: Api, case_id: str, admin: str, purpose: str = "case") -> str:
    return next(r["reviewer_id"] for r in candidates(api, case_id, admin, purpose) if r["eligible"])


def assign(api: Api, case_id: str, admin: str) -> str:
    reviewer = free_reviewer(api, case_id, admin)
    status, _ = api.post(
        f"/cases/{case_id}/reviewers", admin, {"reviewer_id": reviewer, "role_in_case": "primary"}
    )
    assert status == 200
    return reviewer


def test_full_lifecycle_from_open_to_closed(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    support = api.reviewer("support_staff")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    detail = api.get(f"/cases/{case_id}", reviewer)
    assert detail["status"] == "under_review"
    evidence = detail["evidence"][0]["evidence_id"]
    body = {
        "outcome": "violation_confirmed",
        "rationale": "Source traced.",
        "cited_evidence_ids": [evidence],
    }
    status, decided = api.post(f"/cases/{case_id}/decision", reviewer, body)
    assert (status, decided["status"]) == (200, "decided")
    window = api.post(f"/cases/{case_id}/close", admin, {})
    assert window[1]["error"]["code"] == "APPEAL_WINDOW_OPEN"
    status, appealed = api.post(
        f"/cases/{case_id}/appeal", support, {"grounds": "Common phrasing."}
    )
    assert (status, appealed["status"]) == (200, "appealed")
    appeal_reviewer = free_reviewer(api, case_id, admin, "appeal")
    api.post(f"/cases/{case_id}/appeal/reviewer", admin, {"reviewer_id": appeal_reviewer})
    body = {"outcome": "upheld", "rationale": "No new evidence."}
    assert api.post(f"/cases/{case_id}/appeal/outcome", appeal_reviewer, body)[0] == 200
    status, closed = api.post(f"/cases/{case_id}/close", admin, {})
    assert (status, closed["status"]) == (200, "closed")
    kinds = [e["event_type"] for e in api.get(f"/cases/{case_id}/timeline", admin)]
    assert kinds[-6:] == [
        "reviewer_assigned",
        "decision_recorded",
        "appeal_filed",
        "appeal_reviewer_assigned",
        "appeal_decided",
        "case_closed",
    ]


def test_g1_no_decision_without_an_assigned_human(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    evidence = api.get(f"/cases/{case_id}", admin)["evidence"][0]["evidence_id"]
    body = {"outcome": "violation_confirmed", "rationale": "x", "cited_evidence_ids": [evidence]}
    outsider = api.reviewer("academic_reviewer", skip=(reviewer,))
    assert (
        api.post(f"/cases/{case_id}/decision", outsider, body)[1]["error"]["code"] == "NOT_ASSIGNED"
    )
    assert api.post(f"/cases/{case_id}/decision", admin, body)[0] == 403
    empty = {**body, "cited_evidence_ids": []}
    assert (
        api.post(f"/cases/{case_id}/decision", reviewer, empty)[1]["error"]["code"]
        == "EVIDENCE_REQUIRED"
    )


def test_g2_conflicted_reviewer_is_refused(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    rows = candidates(api, case_id, admin)
    conflicted = next(
        r
        for r in rows
        if r["role"] in ("instructor", "academic_reviewer")
        and {x["code"] for x in r["reasons"]} & CONFLICT_CODES
    )
    status, body = api.post(
        f"/cases/{case_id}/reviewers",
        admin,
        {"reviewer_id": conflicted["reviewer_id"], "role_in_case": "primary"},
    )
    assert (status, body["error"]["code"]) == (409, "CONFLICT_OF_INTEREST")
    support = api.reviewer("support_staff")
    status, body = api.post(
        f"/cases/{case_id}/reviewers", admin, {"reviewer_id": support, "role_in_case": "primary"}
    )
    assert (status, body["error"]["code"]) == (422, "VALIDATION_ERROR")
    assert "ROLE_CANNOT_REVIEW" in body["error"]["details"]["reasons"]


def test_g3_evidence_after_decision_needs_a_reopen(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="decided")
    reviewer = api.get(f"/cases/{case_id}", admin)["reviewers"][0]["reviewer_id"]
    evidence = {"kind": "matched_passage", "description": "Another passage."}
    status, body = api.post(f"/cases/{case_id}/evidence", reviewer, evidence)
    assert (status, body["error"]["code"]) == (409, "REOPEN_REQUIRED")
    assert api.post(f"/cases/{case_id}/reopen", reviewer, {"reason": "New evidence."})[0] == 200
    status, detail = api.post(f"/cases/{case_id}/evidence", reviewer, evidence)
    assert (status, detail["status"]) == (200, "under_review")
    events = api.get(f"/cases/{case_id}/timeline", admin)
    assert [e["event_type"] for e in events[-2:]] == ["case_reopened", "evidence_added"]


def test_g4_appeal_needs_an_independent_reviewer_before_closure(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="appealed")
    on_case = api.get(f"/cases/{case_id}", admin)["reviewers"][0]["reviewer_id"]
    status, body = api.post(f"/cases/{case_id}/appeal/reviewer", admin, {"reviewer_id": on_case})
    assert (status, body["error"]["code"]) == (409, "NOT_INDEPENDENT")
    assert api.post(f"/cases/{case_id}/close", admin, {})[1]["error"]["code"] == "APPEAL_UNRESOLVED"
    support = api.reviewer("support_staff")
    assert api.post(f"/cases/{case_id}/close", support, {})[0] == 403
    again = api.post(f"/cases/{case_id}/appeal", support, {"grounds": "Again."})
    assert again[1]["error"]["code"] == "APPEAL_EXISTS"
