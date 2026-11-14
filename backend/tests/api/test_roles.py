"""Learner access: their own queue, case, statement and appeal only; staff access is unchanged."""

from datetime import datetime, timedelta

from integrity.api.deps import get_clock
from integrity.clock import FixedClock
from tests.api.conftest import Api

STAFF_PAGES = ("/audit/findings", "/audit/metrics", "/audit/validation")


def _get(api: Api, path: str, actor: str) -> tuple[int, dict]:  # type: ignore[type-arg]
    response = api.client.get(f"/api{path}", headers={"X-Actor-Id": actor})
    return response.status_code, response.json()


def _first_case(api: Api, admin: str, status: str = "open,under_review,decided") -> tuple[str, str]:
    """The newest case in `status`, and the id of the learner it belongs to."""
    case_id = api.first_case(admin, status=status)
    return case_id, api.get(f"/cases/{case_id}", admin)["learner"]["learner_id"]


def _case_with_action(
    api: Api, admin: str, action: str, allowed: bool, reason: str | None = None
) -> tuple[str, str]:
    """A decided case where the admin's check for `action` matches, and its learner."""
    for row in api.get("/queue?status=decided&limit=200", admin)["items"]:
        detail = api.get(f"/cases/{row['case_id']}", admin)
        check = next(c for c in detail["action_checks"] if c["action"] == action)
        codes = [reason_["code"] for reason_ in check["reasons"]]
        if check["allowed"] == allowed and (reason is None or reason in codes):
            return row["case_id"], detail["learner"]["learner_id"]
    raise LookupError(action)


def test_learner_sees_only_their_own_queue_and_flags(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    _, learner = _first_case(api, admin)
    page = api.get("/queue?limit=200", learner)
    everyone = api.get("/queue?limit=200", admin)
    assert page["total"] == len(page["items"]) < everyone["total"]
    assert all(row["learner_id"] == learner for row in page["items"])
    assert all(f["learner_id"] == learner for f in api.get("/flags?limit=200", learner)["items"])


def test_learner_cannot_open_another_learners_case(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    _, learner = _first_case(api, admin)
    rows = api.get("/queue?limit=200", admin)["items"]
    other = next(r["case_id"] for r in rows if r["learner_id"] != learner)
    for path in (f"/cases/{other}", f"/cases/{other}/timeline"):
        status, body = _get(api, path, learner)
        assert status == 403
        assert body["error"]["code"] == "NOT_YOUR_CASE"
        assert body["error"]["message"] == "You can only view your own cases."
    status, body = api.post(f"/cases/{other}/appeal", learner, {"grounds": "Not my case."})
    assert status == 403
    assert body["error"]["code"] == "NOT_YOUR_CASE"


def test_learner_is_refused_staff_pages_but_can_read_rules(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id, learner = _first_case(api, admin)
    for path in (*STAFF_PAGES, f"/cases/{case_id}/eligible-reviewers"):
        status, body = _get(api, path, learner)
        assert status == 403
        assert body["error"]["code"] == "ROLE_NOT_ALLOWED"
        assert body["error"]["message"] == "Learners cannot use this page."
    status, rules = _get(api, "/rules", learner)
    assert status == 200
    assert rules


def test_learner_adds_only_their_own_statement(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    case_id, learner = _first_case(api, admin, "open,under_review")
    status, body = api.post(
        f"/cases/{case_id}/evidence", learner, {"kind": "matched_passage", "description": "Copied."}
    )
    assert status == 409
    assert body["error"]["code"] == "STATEMENT_ONLY"
    assert body["error"]["message"] == "Learners can add a statement only."

    text = "I wrote the methods section myself."
    status, body = api.post(
        f"/cases/{case_id}/evidence", learner, {"kind": "learner_statement", "description": text}
    )
    assert status == 200
    added = next(e for e in body["evidence"] if e["description"] == text)
    assert added["added_by"] == learner


def test_learner_appeals_own_adverse_decision_inside_the_window_only(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    closed_id, closed_learner = _case_with_action(
        api, admin, "file_appeal", allowed=False, reason="APPEAL_WINDOW_CLOSED"
    )
    status, body = api.post(f"/cases/{closed_id}/appeal", closed_learner, {"grounds": "Too late."})
    assert status == 409
    assert body["error"]["code"] == "APPEAL_WINDOW_CLOSED"

    # Every seed decision is past its window at the fixed test clock, so move the clock to a day
    # after a decision: inside the window, the learner can appeal their own confirmed violation.
    case_id, learner = _first_case(api, admin, "decided")
    decided_at = api.get(f"/cases/{case_id}", admin)["decisions"][-1]["decided_at"]
    soon = datetime.fromisoformat(decided_at.replace("Z", "+00:00")) + timedelta(days=1)
    api.client.app.dependency_overrides[get_clock] = lambda: FixedClock(soon)  # type: ignore[attr-defined]
    status, body = api.post(
        f"/cases/{case_id}/appeal", learner, {"grounds": "The matched passage is a common phrase."}
    )
    assert status == 200
    assert body["status"] == "appealed"
    assert api.get(f"/cases/{case_id}/timeline", admin)[-1]["actor_id"] == learner


def test_actor_search_finds_learners_and_staff_without_sign_in(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    _, learner = _first_case(api, admin)
    people = api.client.get("/api/actors", params={"role": "learner", "q": learner}).json()
    assert [p["actor_id"] for p in people] == [learner]
    assert people[0]["role"] == "learner"
    staff = api.client.get("/api/actors", params={"q": admin}).json()
    assert staff[0]["actor_id"] == admin
    assert staff[0]["role"] == "academic_administrator"


def test_staff_still_see_every_case_and_the_audit_pages(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    _, learner = _first_case(api, admin)
    other = next(
        r["case_id"]
        for r in api.get("/queue?limit=200", admin)["items"]
        if r["learner_id"] != learner
    )
    assert api.get(f"/cases/{other}", admin)["case_id"] == other
    for path in STAFF_PAGES:
        assert _get(api, path, admin)[0] == 200
