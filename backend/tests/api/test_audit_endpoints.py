"""The live auditor finds the labelled anomalies; metrics and validation files are served."""

from tests.api.conftest import Api


def test_live_auditor_finds_one_anomaly_per_issue_type_and_filters_by_case(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    report = api.get("/audit/findings", admin)
    assert set(report["counts"].values()) == {1}
    one = report["findings"][0]
    narrowed = api.get(f"/audit/findings?case_id={one['case_id']}", admin)
    assert [f["entity_id"] for f in narrowed["findings"]] == [one["entity_id"]]
    clean = next(
        c["case_id"]
        for c in api.get("/queue?limit=200", admin)["items"]
        if c["case_id"] not in {f["case_id"] for f in report["findings"]}
    )
    assert api.get(f"/audit/findings?case_id={clean}", admin)["findings"] == []
    assert api.get("/audit/findings?case_id=CAS-2026-999999", admin)["error"]["code"] == "NOT_FOUND"


def test_a_decision_made_through_the_api_adds_no_finding(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    before = api.get("/audit/findings", admin)["counts"]
    case_id = api.first_case(admin, status="open")
    rows = api.get(f"/cases/{case_id}/eligible-reviewers", admin)
    reviewer = next(r["reviewer_id"] for r in rows if r["eligible"])
    api.post(
        f"/cases/{case_id}/reviewers", admin, {"reviewer_id": reviewer, "role_in_case": "primary"}
    )
    detail = api.get(f"/cases/{case_id}", admin)
    matched = next(e["evidence_id"] for e in detail["evidence"] if e["kind"] == "matched_passage")
    body = {
        "outcome": "violation_confirmed",
        "rationale": "Source traced to the matched passage.",
        "cited_evidence_ids": [matched],
    }
    assert api.post(f"/cases/{case_id}/decision", reviewer, body)[0] == 200
    assert api.get("/audit/findings", admin)["counts"] == before


def test_metrics_and_validation_files_carry_the_dataset_hash(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    metrics, validation = api.get("/audit/metrics", admin), api.get("/audit/validation", admin)
    assert metrics["dataset_hash"] == validation["dataset_hash"]
    assert {r["issue_type"] for r in metrics["auditor"]} == set(
        api.get("/audit/findings", admin)["counts"]
    )
