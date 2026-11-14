"""Identifier formats of the brief."""

from integrity import ids


def test_ids_follow_the_brief_formats() -> None:
    case = ids.case_id(17)
    assert case == "CAS-2026-000017"
    assert ids.report_id(ids.submission_id(1)) == "SIM-SUB-2026-000001-01"
    assert ids.evidence_id(case, 1) == "EVD-CAS-2026-000017-001"
    assert ids.appeal_id(case) == "APL-CAS-2026-000017-01"
    assert ids.rule_id(2) == "INT-2026-000002"


def test_validation_and_next_suffix() -> None:
    assert ids.is_valid("evidence", "EVD-CAS-2026-000017-001")
    assert not ids.is_valid("evidence", "EVD-CAS-2026-000017-1")
    assert ids.next_suffix([]) == 1
    assert ids.next_suffix(["DEC-CAS-2026-000017-01", "DEC-CAS-2026-000017-02"]) == 3
