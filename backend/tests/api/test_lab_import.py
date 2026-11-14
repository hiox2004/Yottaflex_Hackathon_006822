"""Test Lab import: cases become real submissions, reports, cases and evidence, all or nothing."""

import re

from integrity.validation.checks import run_checks
from tests.api.conftest import Api

IMPORT_ERROR = "Only an academic administrator can import test cases."


def case(
    lab_id: str, raw: float, quoted: float, template: float, **extra: object
) -> dict[str, object]:
    return {"id": lab_id, "scores": {"raw": raw, "quoted": quoted, "template": template}, **extra}


PRIORITY = case(
    "L-PRIORITY",
    0.92,
    0.02,
    0.01,
    decision={"outcome": "no_violation", "rationale": "probe, ignored by the import"},
    expect={"band": "priority_review"},
    evidence=[
        {"kind": "matched_passage", "description": "Paragraph 3 matches a web page"},
        {"kind": "learner_statement", "description": "I quoted the source without citing it"},
    ],
)
REVIEW = case(
    "L-REVIEW",
    0.70,
    0.05,
    0.00,
    learner_id="LRN-000001",
    assessment_id="ASM-000001",
    evidence=[{"kind": "source_reference", "description": "Source article from 2024"}],
)
QUOTE_DISMISSED = case("L-QUOTE", 0.71, 0.30, 0.20)
TEMPLATE_DISMISSED = case("L-TEMPLATE", 0.90, 0.10, 0.50)
NOT_FLAGGED = case("L-CLEAN", 0.40, 0.00, 0.00)
MIXED = [PRIORITY, REVIEW, QUOTE_DISMISSED, TEMPLATE_DISMISSED, NOT_FLAGGED]

SUB = re.compile(r"^SUB-2026-\d{6}$")
REPORT = re.compile(r"^SIM-SUB-2026-\d{6}-01$")
CASE = re.compile(r"^CAS-2026-\d{6}$")
EVIDENCE = re.compile(r"^EVD-CAS-2026-\d{6}-\d{3}$")


def counts(api: Api) -> tuple[int, int]:
    """Submissions and cases in the throwaway test schema."""
    subs = api.con.execute("SELECT count(*) AS n FROM submission").fetchone()["n"]
    cases = api.con.execute("SELECT count(*) AS n FROM integrity_case").fetchone()["n"]
    return subs, cases


def test_mixed_batch_becomes_records_the_workflow_shows(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    status, out = api.post("/lab/import", admin, {"cases": MIXED})
    assert status == 200
    created = {row["lab_id"]: row for row in out["created"]}
    assert [row["lab_id"] for row in out["created"]] == [c["id"] for c in MIXED]  # request order
    assert {k: v["outcome"] for k, v in created.items()} == {
        "L-PRIORITY": "case_opened",
        "L-REVIEW": "case_opened",
        "L-QUOTE": "dismissed",
        "L-TEMPLATE": "dismissed",
        "L-CLEAN": "not_flagged",
    }
    for row in created.values():
        assert SUB.match(row["submission_id"])
        assert REPORT.match(row["similarity_report_id"])
        assert row["similarity_report_id"] == f"SIM-{row['submission_id']}-01"
    priority = created["L-PRIORITY"]
    assert CASE.match(priority["case_id"])
    assert len(priority["evidence_ids"]) == 2
    for evidence_id in priority["evidence_ids"]:
        assert EVIDENCE.match(evidence_id)
        assert evidence_id.startswith(f"EVD-{priority['case_id']}-")
    assert created["L-QUOTE"]["case_id"] is None
    assert created["L-QUOTE"]["evidence_ids"] == []

    # The opened cases are in the queue and their detail shows the evidence, status open.
    queue_ids = {row["case_id"] for row in api.get("/queue?limit=200", admin)["items"]}
    assert {created["L-PRIORITY"]["case_id"], created["L-REVIEW"]["case_id"]} <= queue_ids
    detail = api.get(f"/cases/{priority['case_id']}", admin)
    assert detail["status"] == "open"
    assert [e["kind"] for e in detail["evidence"]] == ["matched_passage", "learner_statement"]
    assert detail["flag"]["band"] == "priority_review"

    # The dismissed flags are in the Dismissed tab; the clean one is not a flag at all.
    dismissed = {row["similarity_report_id"] for row in api.get("/flags?limit=200", admin)["items"]}
    assert created["L-QUOTE"]["similarity_report_id"] in dismissed
    assert created["L-TEMPLATE"]["similarity_report_id"] in dismissed
    assert created["L-CLEAN"]["similarity_report_id"] not in dismissed

    # Imported records keep every validation check green and the auditor finds nothing in them.
    assert run_checks(api.con) == []
    imported = {created["L-PRIORITY"]["case_id"], created["L-REVIEW"]["case_id"]}
    assert not [
        f for f in api.get("/audit/findings", admin)["findings"] if f["case_id"] in imported
    ]


def test_only_an_academic_administrator_can_import(api: Api) -> None:
    reviewer = api.reviewer("academic_reviewer")
    status, out = api.post("/lab/import", reviewer, {"cases": [PRIORITY]})
    assert status == 403
    assert out["error"]["code"] == "ROLE_NOT_ALLOWED"
    assert out["error"]["message"] == IMPORT_ERROR


def test_malformed_batches_are_rejected_with_422(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    bad = [
        {"cases": []},
        {"cases": [case("X", 1.4, 0, 0)]},  # score above 1
        {"cases": [case("X", 0.5, 0.1, 0.1, learner_id="LRN-1")]},  # not an id
        {"cases": [case("X", 0.5, 0.1, 0.1, evidence=[{"kind": "bogus", "description": "x"}])]},
        {
            "cases": [
                case(
                    "X", 0.5, 0.1, 0.1, evidence=[{"kind": "matched_passage", "description": "  "}]
                )
            ]
        },
    ]
    for body in bad:
        assert api.post("/lab/import", admin, body)[0] == 422, body
    # Quoted and template above raw would break the similarity_report CHECK: refused instead.
    status, out = api.post("/lab/import", admin, {"cases": [case("X", 0.5, 0.3, 0.3)]})
    assert status == 422
    assert out["error"]["code"] == "VALIDATION_ERROR"


def test_one_bad_learner_fails_the_whole_batch(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    before = counts(api)
    body = {"cases": [PRIORITY, case("L-BAD", 0.9, 0.0, 0.0, learner_id="LRN-999999")]}
    status, out = api.post("/lab/import", admin, body)
    assert status == 422
    assert "LRN-999999" in out["error"]["message"]
    assert counts(api) == before  # the valid first case was rolled back too
