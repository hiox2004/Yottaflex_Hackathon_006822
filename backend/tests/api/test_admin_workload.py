"""The administrator's workload overview: access, queue totals, order and suggestions."""

from tests.api.conftest import Api


def test_admin_sees_totals_that_match_the_queue(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    body = api.get("/admin/workload", admin)
    queue = api.get("/queue?limit=200", admin)["counts"]
    totals = body["totals"]
    assert totals["unassigned"] + totals["under_review"] == queue["under_review"]
    assert (
        totals["appeals_waiting_reviewer"] + totals["appeals_in_review"] == queue["awaiting_appeal"]
    )
    assert totals["closed"] == queue["closed"]
    assert totals["dismissed_flags"] == queue["dismissed_flags"]
    assert set(body) == {"generated_at", "totals", "reviewers", "suggested_for_unassigned"}


def test_reviewers_are_sorted_by_active_cases_then_name(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    reviewers = api.get("/admin/workload", admin)["reviewers"]
    assert reviewers, "the starter dataset has reviewers"
    keys = [(-r["active_cases"], r["name"]) for r in reviewers]
    assert keys == sorted(keys)
    assert all(r["role"] in ("instructor", "academic_reviewer") for r in reviewers)


def test_non_admin_is_refused(api: Api) -> None:
    instructor = api.reviewer("instructor")
    response = api.client.get("/api/admin/workload", headers={"X-Actor-Id": instructor})
    assert response.status_code == 403
    error = response.json()["error"]
    assert error["code"] == "ROLE_NOT_ALLOWED"
    assert error["message"] == "Only an academic administrator can see staff workload."


def test_suggestions_are_conflict_free_and_match_the_assign_verdict(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    suggestions = api.get("/admin/workload", admin)["suggested_for_unassigned"]
    assert len(suggestions) <= 10
    checked = [s for s in suggestions if s["suggested"]]
    assert checked, "the starter dataset has open cases with eligible reviewers"
    case = checked[0]
    verdicts = {
        r["reviewer_id"]: r["eligible"]
        for r in api.get(f"/cases/{case['case_id']}/eligible-reviewers", admin)
    }
    for suggested in case["suggested"]:
        assert verdicts[suggested["reviewer_id"]] is True
    assert len(case["suggested"]) <= 3
    loads = [s["active_cases"] for s in case["suggested"]]
    assert loads == sorted(loads)
