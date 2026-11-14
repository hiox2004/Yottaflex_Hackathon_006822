"""The Test Lab runs external cases through the pure rules and compares them with `expect`."""

from tests.api.conftest import Api

SCORES = {"raw": 0.72, "quoted": 0.05, "template": 0.0}


def test_lab_scores_triage_and_exception_checks_against_expectations(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    body = {
        "cases": [
            {
                "id": "T1",
                "scores": SCORES,
                "expect": {"is_flag": True, "opens_case": True, "band": "review"},
            },
            {
                "id": "T2",
                "scores": {"raw": 0.71, "quoted": 0.3, "template": 0.2},
                "expect": {"opens_case": False, "dismissal_reason": "quote_only"},
            },
            {
                "id": "T3",
                "scores": SCORES,
                "decision": {
                    "outcome": "violation_confirmed",
                    "rationale": "The passages match an uncited source.",
                },
                "expect": {"decision_blocked": True},
            },
            {
                "id": "T4",
                "scores": SCORES,
                "late_evidence": {"case_reopened_first": False},
                "expect": {"evidence_blocked": True},
            },
            {"id": "T5", "scores": SCORES, "expect": {"band": "priority_review"}},
        ]
    }
    status, out = api.post("/lab/run", admin, body)
    assert status == 200
    assert [r["verdict"] for r in out["results"]] == ["pass", "pass", "pass", "pass", "fail"]
    assert (out["passed"], out["failed"]) == (4, 1)


def test_lab_rejects_malformed_cases(api: Api) -> None:
    admin = api.reviewer("academic_administrator")
    status, _ = api.post(
        "/lab/run",
        admin,
        {"cases": [{"id": "X", "scores": {"raw": 1.4, "quoted": 0, "template": 0}}]},
    )
    assert status == 422
