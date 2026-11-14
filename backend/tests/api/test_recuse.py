"""Recusal: an assigned reviewer steps aside (logged), and a conflict is re-checked at decision."""

from tests.api.conftest import Api

FINDING = "The passages match an uncited external source without quotation."


def assign(api: Api, case_id: str, admin: str) -> str:
    """Assign the first eligible reviewer as primary and return their id."""
    candidates = api.get(f"/cases/{case_id}/eligible-reviewers?purpose=case", admin)
    reviewer: str = next(r["reviewer_id"] for r in candidates if r["eligible"])
    status, _ = api.post(
        f"/cases/{case_id}/reviewers", admin, {"reviewer_id": reviewer, "role_in_case": "primary"}
    )
    assert status == 200
    return reviewer


def confirm(api: Api, case_id: str, reviewer: str) -> tuple[int, dict]:  # type: ignore[type-arg]
    detail = api.get(f"/cases/{case_id}", reviewer)
    evidence = next(e["evidence_id"] for e in detail["evidence"] if e["kind"] == "matched_passage")
    body = {
        "outcome": "violation_confirmed",
        "rationale": FINDING,
        "cited_evidence_ids": [evidence],
    }
    return api.post(f"/cases/{case_id}/decision", reviewer, body)


def test_recusal_is_logged_and_the_reviewer_drops_off_the_case(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    reason = "I supervised this learner's last assessment."

    status, detail = api.post(f"/cases/{case_id}/recuse", reviewer, {"reason": reason})

    assert (status, detail["status"]) == (200, "under_review")
    assert reviewer not in [r["reviewer_id"] for r in detail["reviewers"]]
    recused = [
        e
        for e in api.get(f"/cases/{case_id}/timeline", admin)
        if e["event_type"] == "reviewer_recused"
    ]
    assert len(recused) == 1
    assert (recused[0]["actor_id"], recused[0]["reason"]) == (reviewer, reason)


def test_a_blank_reason_is_refused_and_nothing_is_logged(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)

    status, body = api.post(f"/cases/{case_id}/recuse", reviewer, {"reason": "   "})

    assert status == 409
    assert body["error"]["code"] == "RECUSAL_REASON_REQUIRED"
    assert all(
        e["event_type"] != "reviewer_recused" for e in api.get(f"/cases/{case_id}/timeline", admin)
    )


def test_a_recused_reviewer_cannot_act_or_be_reassigned(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    api.post(
        f"/cases/{case_id}/recuse", reviewer, {"reason": "Personal connection to the learner."}
    )

    status, body = api.post(
        f"/cases/{case_id}/evidence",
        reviewer,
        {"kind": "learner_statement", "description": "Note."},
    )
    assert (status, body["error"]["code"]) == (409, "NOT_ASSIGNED")
    assert confirm(api, case_id, reviewer)[1]["error"]["code"] == "NOT_ASSIGNED"

    status, body = api.post(
        f"/cases/{case_id}/reviewers", admin, {"reviewer_id": reviewer, "role_in_case": "secondary"}
    )
    assert status == 409
    assert "ALREADY_ON_CASE" in body["error"]["details"]["reasons"]


def test_admin_assigns_a_replacement_primary_after_a_recusal(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    api.post(
        f"/cases/{case_id}/recuse", reviewer, {"reason": "Personal connection to the learner."}
    )

    replacement = assign(api, case_id, admin)

    detail = api.get(f"/cases/{case_id}", admin)
    assert [r["reviewer_id"] for r in detail["reviewers"]] == [replacement]


def test_decision_is_refused_when_the_reviewer_now_has_a_conflict(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)
    learner_department = api.get(f"/cases/{case_id}", admin)["learner"]["department"]
    # The conflict appears after assignment: the reviewer now shares the learner's department.
    api.con.execute(
        "UPDATE reviewer SET department = %s WHERE reviewer_id = %s",
        (learner_department, reviewer),
    )

    status, body = confirm(api, case_id, reviewer)

    assert (status, body["error"]["code"]) == (409, "CONFLICT_OF_INTEREST")
    assert body["error"]["message"].startswith("You now have a conflict of interest")
    assert "SAME_DEPARTMENT" in body["error"]["details"]["reasons"]


def test_a_reviewer_without_a_conflict_can_still_decide(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id = api.first_case(admin, status="open")
    reviewer = assign(api, case_id, admin)

    status, detail = confirm(api, case_id, reviewer)

    assert (status, detail["status"]) == (200, "decided")
