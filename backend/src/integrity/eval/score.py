"""Score the auditor and the triage rule against the ground truth (the only reader besides datagen).

Auditor: per issue type, true positives are findings on a labelled anomaly case; a finding on a
decoy case (or any unlabelled case) is a false positive; an anomaly not found is a false negative.
Triage: how the documented rule treated each latent scenario, per submission. A submission whose
outcome differs from the scenario's expected outcome is a miss. Synthetic scores prove rule
coverage, not generalisation.
"""

import csv
import hashlib
import json
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

import psycopg

from integrity.auditor import Finding
from integrity.config import REPO_ROOT
from integrity.models import IssueType

SCENARIOS = ("clean", "legitimate_quote", "shared_template", "false_positive", "genuine_copy")

# What a correct rule does with each latent scenario, per submission.
EXPECTED_OUTCOME = {
    "clean": "not_flagged",
    "legitimate_quote": "dismissed",
    "shared_template": "dismissed",
    "false_positive": "case_opened",
    "genuine_copy": "case_opened",
}

CAVEAT = "synthetic data: scores show rule coverage, not generalisation"


def truth_rows(scale: str) -> list[dict[str, str]]:
    path = REPO_ROOT / "data" / "ground_truth" / scale / "ground_truth.csv"
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dataset_hash(scale: str) -> str:
    """SHA-256 of the dataset's manifest, which itself lists the hash of every data file."""
    return _sha256(REPO_ROOT / "data" / scale / "manifest.json")


def ground_truth_hashes(scale: str) -> dict[str, str]:
    """SHA-256 of each ground-truth file, so a reader can tell which answer key was scored."""
    folder = REPO_ROOT / "data" / "ground_truth" / scale
    return {name: _sha256(folder / name) for name in ("ground_truth.csv", "ground_truth.json")}


def _ratio(numerator: int, denominator: int) -> float | None:
    """Rounded ratio to 3 places, or None when the denominator is zero (undefined measure)."""
    if denominator == 0:
        return None
    value = (Decimal(numerator) / Decimal(denominator)).quantize(Decimal("0.001"), ROUND_HALF_UP)
    return float(value)


def auditor_scores(findings: list[Finding], truth: list[dict[str, str]]) -> list[dict[str, Any]]:
    """Precision, recall and F1 per issue type, over distinct cases, with found and labelled counts.

    precision = hits / found, recall = hits / labelled, f1 = 2*hits / (found + labelled).
    A ratio whose denominator is zero is None, not 1.0.
    """
    rows = []
    for issue in IssueType:
        labelled = {
            r["case_id"]
            for r in truth
            if r["record_type"] == "anomaly" and r["issue_type"] == issue
        }
        found = {f.case_id for f in findings if f.issue_type == issue}
        hits = len(labelled & found)
        rows.append(
            {
                "issue_type": issue.value,
                "precision": _ratio(hits, len(found)),
                "recall": _ratio(hits, len(labelled)),
                "f1": _ratio(2 * hits, len(found) + len(labelled)),
                "found": len(found),
                "labelled": len(labelled),
            }
        )
    return rows


def triage_scores(
    flags: list[tuple[str, str]], truth: list[dict[str, str]]
) -> list[dict[str, Any]]:
    """Per latent scenario, from (submission_id, outcome) rows of v_flag.

    Flag counts (flagged, cases, dismissed) count flag reports. The submission counts (expected,
    not_flagged, hits, misses, hit_rate) classify each latent submission once: case_opened if any
    of its flags opened a case, else dismissed if it has a flag, else not_flagged.
    misses = expected - hits; hit_rate = hits / expected (None when the scenario is empty).
    """
    scenario = {r["entity_id"]: r["label"] for r in truth if r["record_type"] == "latent_scenario"}
    tally: dict[str, dict[str, Any]] = {
        name: {
            "scenario": name,
            "expected_outcome": EXPECTED_OUTCOME[name],
            "expected": 0,
            "cases": 0,
            "flagged": 0,
            "dismissed": 0,
            "not_flagged": 0,
            "hits": 0,
            "misses": 0,
            "hit_rate": None,
        }
        for name in SCENARIOS
    }
    outcomes: dict[str, set[str]] = defaultdict(set)
    for submission_id, outcome in flags:
        row = tally[scenario[submission_id]]
        row["flagged"] += 1
        row["cases" if outcome == "case_opened" else "dismissed"] += 1
        outcomes[submission_id].add(outcome)
    for submission_id, name in scenario.items():
        row = tally[name]
        seen = outcomes.get(submission_id, set())
        if "case_opened" in seen:
            result = "case_opened"
        elif seen:
            result = "dismissed"
        else:
            result = "not_flagged"
            row["not_flagged"] += 1
        row["expected"] += 1
        row["hits" if result == row["expected_outcome"] else "misses"] += 1
    for row in tally.values():
        row["hit_rate"] = _ratio(row["hits"], row["expected"])
    return list(tally.values())


def triage_by_scenario(
    con: psycopg.Connection[Any], truth: list[dict[str, str]]
) -> list[dict[str, Any]]:
    flags = con.execute(
        "SELECT submission_id, outcome FROM v_flag ORDER BY submission_id"
    ).fetchall()
    return triage_scores([(sid, outcome) for sid, outcome in flags], truth)


def evaluate(con: psycopg.Connection[Any], findings: list[Finding], scale: str) -> dict[str, Any]:
    """The AuditMetrics file content for `scale`."""
    truth = truth_rows(scale)
    return {
        "caveat": CAVEAT,
        "dataset_hash": dataset_hash(scale),
        "ground_truth_sha256": ground_truth_hashes(scale),
        "auditor": auditor_scores(findings, truth),
        "triage": triage_by_scenario(con, truth),
    }


def write_json(path: Path, payload: object) -> None:
    text = json.dumps(payload, sort_keys=True, indent=2, ensure_ascii=False) + "\n"
    path.write_bytes(text.encode("utf-8"))
