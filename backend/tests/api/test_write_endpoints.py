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


INCRIMINATING = {"matched_passage", "source_reference"}
FINDING = "The passages match an uncited external source without quotation."


def incriminating(detail: dict) -> str:  # type: ignore[type-arg]
    return next(e["evidence_id"] for e in detail["evidence"] if e["kind"] in INCRIMINATING)


def test_full_lifecycle_from_open_to_closed(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    support = api.reviewer("support_staff")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    detail = api.get(f"/cases/{case_id}", reviewer)
    assert detail["status"] == "under_review"
    body = {
        "outcome": "violation_confirmed",
        "rationale": FINDING,
        "cited_evidence_ids": [incriminating(detail)],
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


def test_confirming_a_violation_needs_a_finding_and_a_matched_passage(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    support = api.reviewer("support_staff")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    matched = incriminating(api.get(f"/cases/{case_id}", reviewer))
    detail = api.post(
        f"/cases/{case_id}/evidence",
        support,
        {"kind": "learner_statement", "description": "Common phrasing."},
    )[1]
    statement = next(
        e["evidence_id"] for e in detail["evidence"] if e["kind"] == "learner_statement"
    )
    path = f"/cases/{case_id}/decision"
    short = {
        "outcome": "violation_confirmed",
        "rationale": "Too short.",
        "cited_evidence_ids": [matched],
    }
    status, body = api.post(path, reviewer, short)
    assert (status, body["error"]["code"]) == (409, "RATIONALE_TOO_SHORT")
    statement_only = {
        "outcome": "violation_confirmed",
        "rationale": FINDING,
        "cited_evidence_ids": [statement],
    }
    status, body = api.post(path, reviewer, statement_only)
    assert (status, body["error"]["code"]) == (409, "NO_INCRIMINATING_EVIDENCE")
    assert api.get(f"/cases/{case_id}", reviewer)["status"] == "under_review"


def test_confirming_with_a_19_character_finding_is_refused(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    matched = incriminating(api.get(f"/cases/{case_id}", reviewer))
    nineteen = "Quoted passage text"
    assert len(nineteen) == 19
    body = {
        "outcome": "violation_confirmed",
        "rationale": nineteen,
        "cited_evidence_ids": [matched],
    }
    status, error = api.post(f"/cases/{case_id}/decision", reviewer, body)
    assert (status, error["error"]["code"]) == (409, "RATIONALE_TOO_SHORT")


def test_no_violation_with_a_short_rationale_and_exculpatory_evidence_succeeds(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    detail = api.post(
        f"/cases/{case_id}/evidence",
        reviewer,
        {"kind": "quote_citation", "description": "Properly quoted and cited."},
    )[1]
    quote = next(e["evidence_id"] for e in detail["evidence"] if e["kind"] == "quote_citation")
    body = {
        "outcome": "no_violation",
        "rationale": "Common phrasing.",
        "cited_evidence_ids": [quote],
    }
    status, decided = api.post(f"/cases/{case_id}/decision", reviewer, body)
    assert (status, decided["status"]) == (200, "decided")


def test_g1_no_decision_without_an_assigned_human(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    matched = incriminating(api.get(f"/cases/{case_id}", admin))
    body = {"outcome": "violation_confirmed", "rationale": FINDING, "cited_evidence_ids": [matched]}
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


def test_appeal_after_the_window_is_refused_and_not_offered(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    support = api.reviewer("support_staff")
    # Seeded decisions are months before the fixed clock (2026-11-14): the window has closed.
    case_id = api.first_case(admin, status="decided")
    status, body = api.post(f"/cases/{case_id}/appeal", support, {"grounds": "Too late."})
    assert (status, body["error"]["code"]) == (409, "APPEAL_WINDOW_CLOSED")
    assert "The appeal window closed on" in body["error"]["message"]
    detail = api.get(f"/cases/{case_id}", support)
    assert "file_appeal" not in detail["allowed_actions"]


def test_admin_reassigns_the_appeal_reviewer_and_history_is_kept(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    support = api.reviewer("support_staff")
    case_id = api.first_case(admin, status="appeal_review")
    detail = api.get(f"/cases/{case_id}", admin)
    current = detail["appeal"]["reviewer_id"]
    other = next(
        r["reviewer_id"]
        for r in candidates(api, case_id, admin, "appeal")
        if r["eligible"] and r["reviewer_id"] != current
    )
    assert api.post(f"/cases/{case_id}/appeal/reviewer", support, {"reviewer_id": other})[0] == 403
    status, body = api.post(f"/cases/{case_id}/appeal/reviewer", admin, {"reviewer_id": current})
    assert (status, body["error"]["code"]) == (409, "SAME_APPEAL_REVIEWER")
    on_case = detail["reviewers"][0]["reviewer_id"]
    status, body = api.post(f"/cases/{case_id}/appeal/reviewer", admin, {"reviewer_id": on_case})
    assert (status, body["error"]["code"]) == (409, "NOT_INDEPENDENT")
    status, reassigned = api.post(
        f"/cases/{case_id}/appeal/reviewer", admin, {"reviewer_id": other}
    )
    assert (status, reassigned["status"]) == (200, "appeal_review")
    assert reassigned["appeal"]["reviewer_id"] == other
    last = api.get(f"/cases/{case_id}/timeline", admin)[-1]
    assert last["event_type"] == "appeal_reviewer_assigned"
    assert last["from_status"] == last["to_status"] == "appeal_review"
    assert f"Reassigned from {current} to {other}" in last["reason"]


def decided_open_case(api: Api, admin: str, outcome: str) -> str:
    """A case assigned and decided today (the fixed clock), so its appeal window is open."""
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    detail = api.get(f"/cases/{case_id}", reviewer)
    first = detail["evidence"][0]["evidence_id"]
    cited = [incriminating(detail)] if outcome == "violation_confirmed" else [first]
    body = {"outcome": outcome, "rationale": FINDING, "cited_evidence_ids": cited}
    assert api.post(f"/cases/{case_id}/decision", reviewer, body)[0] == 200
    return case_id


def test_a_clean_decision_closes_at_once_for_the_administrator(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    support = api.reviewer("support_staff")
    case_id = decided_open_case(api, admin, "no_violation")
    assert api.post(f"/cases/{case_id}/close", support, {})[0] == 403
    status, closed = api.post(f"/cases/{case_id}/close", admin, {})
    assert (status, closed["status"]) == (200, "closed")


def test_an_adverse_decision_needs_a_waiver_inside_the_window(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = decided_open_case(api, admin, "violation_confirmed")
    status, refused = api.post(f"/cases/{case_id}/close", admin, {})
    assert (status, refused["error"]["code"]) == (409, "APPEAL_WINDOW_OPEN")
    checks = api.get(f"/cases/{case_id}", admin)["action_checks"]
    check = next(c for c in checks if c["action"] == "close")
    assert check["waivable"] is True
    assert check["allowed"] is False
    blank = {"waive_appeal_window": True, "reason": "   "}
    refused_blank = api.post(f"/cases/{case_id}/close", admin, blank)[1]
    assert refused_blank["error"]["code"] == "WAIVER_REASON_REQUIRED"
    waived = {"waive_appeal_window": True, "reason": "Learner waived the appeal in writing."}
    status, closed = api.post(f"/cases/{case_id}/close", admin, waived)
    assert (status, closed["status"]) == (200, "closed")
    last = api.get(f"/cases/{case_id}/timeline", admin)[-1]
    assert last["event_type"] == "case_closed"
    assert last["reason"] == "Appeal window waived: Learner waived the appeal in writing."


def test_closing_without_a_body_still_works(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    # Seeded decisions are months old: the window has closed, so a plain close is allowed.
    case_id = api.first_case(admin, status="decided")
    response = api.client.post(f"/api/cases/{case_id}/close", headers={"X-Actor-Id": admin})
    assert (response.status_code, response.json()["status"]) == (200, "closed")
    detail = api.get(f"/cases/{case_id}", admin)
    assert next(c for c in detail["action_checks"] if c["action"] == "close")["waivable"] is False
