"""Eval scoring: undefined ratios are None, miss counts per scenario, and stable hashes."""

import hashlib

from integrity.auditor import Finding
from integrity.config import REPO_ROOT
from integrity.eval.score import (
    CAVEAT,
    _ratio,
    auditor_scores,
    dataset_hash,
    ground_truth_hashes,
    triage_scores,
)
from integrity.models import IssueType


def test_ratio_is_none_when_the_denominator_is_empty() -> None:
    assert _ratio(0, 0) is None
    assert _ratio(0, 4) == 0.0
    assert _ratio(1, 3) == 0.333


def test_auditor_scores_with_no_findings_and_no_labels_are_undefined() -> None:
    row = next(r for r in auditor_scores([], []) if r["issue_type"] == IssueType.REVIEWER_CONFLICT)
    assert row["found"] == 0
    assert row["labelled"] == 0
    assert row["precision"] is None
    assert row["recall"] is None
    assert row["f1"] is None


def test_auditor_scores_count_found_and_labelled_cases() -> None:
    truth = [
        {"record_type": "anomaly", "issue_type": "REVIEWER_CONFLICT", "case_id": c}
        for c in ("CAS-1", "CAS-2")
    ]
    findings = [Finding("REVIEWER_CONFLICT", "CAS-1", "x", "d")]
    row = next(
        r for r in auditor_scores(findings, truth) if r["issue_type"] == IssueType.REVIEWER_CONFLICT
    )
    assert row["found"] == 1
    assert row["labelled"] == 2
    assert row["precision"] == 1.0
    assert row["recall"] == 0.5
    assert row["f1"] == 0.667


def _latent(entity_id: str, label: str) -> dict[str, str]:
    return {"record_type": "latent_scenario", "entity_id": entity_id, "label": label}


def test_triage_counts_misses_per_scenario() -> None:
    truth = [
        _latent("S1", "genuine_copy"),
        _latent("S2", "genuine_copy"),
        _latent("S3", "genuine_copy"),
        _latent("S4", "genuine_copy"),
        _latent("S5", "legitimate_quote"),
        _latent("S6", "clean"),
        _latent("S7", "clean"),
    ]
    flags = [
        ("S1", "case_opened"),
        ("S2", "dismissed"),
        ("S3", "dismissed"),
        ("S3", "case_opened"),  # one case opened outranks a dismissed sibling flag
        ("S5", "dismissed"),
        ("S6", "dismissed"),
    ]
    rows = {r["scenario"]: r for r in triage_scores(flags, truth)}

    genuine = rows["genuine_copy"]
    assert genuine["expected_outcome"] == "case_opened"
    assert (genuine["expected"], genuine["hits"], genuine["misses"]) == (4, 2, 2)
    assert (genuine["cases"], genuine["dismissed"], genuine["not_flagged"]) == (2, 2, 1)
    assert genuine["hit_rate"] == 0.5

    assert rows["legitimate_quote"]["expected_outcome"] == "dismissed"
    assert (rows["legitimate_quote"]["hits"], rows["legitimate_quote"]["misses"]) == (1, 0)

    clean = rows["clean"]
    assert clean["expected_outcome"] == "not_flagged"
    assert (clean["hits"], clean["misses"], clean["not_flagged"]) == (1, 1, 1)
    assert clean["hit_rate"] == 0.5

    empty = rows["false_positive"]
    assert (empty["expected"], empty["misses"], empty["hit_rate"]) == (0, 0, None)


def test_dataset_hash_is_the_sha256_of_the_manifest_and_repeatable() -> None:
    manifest = (REPO_ROOT / "data" / "starter" / "manifest.json").read_bytes()
    assert dataset_hash("starter") == hashlib.sha256(manifest).hexdigest()
    assert dataset_hash("starter") == dataset_hash("starter")


def test_ground_truth_hashes_cover_both_files_and_are_repeatable() -> None:
    hashes = ground_truth_hashes("starter")
    folder = REPO_ROOT / "data" / "ground_truth" / "starter"
    assert set(hashes) == {"ground_truth.csv", "ground_truth.json"}
    assert (
        hashes["ground_truth.csv"]
        == hashlib.sha256((folder / "ground_truth.csv").read_bytes()).hexdigest()
    )
    assert hashes == ground_truth_hashes("starter")
    assert CAVEAT.startswith("synthetic data")
