"""Score the auditor and the triage rule against the ground truth (the only reader besides datagen).

Auditor: per issue type, true positives are findings on a labelled anomaly case; a finding on a
decoy case (or any unlabelled case) is a false positive; an anomaly not found is a false negative.
Triage: how the documented rule treated each latent scenario. Genuine copies that are dismissed or
never flagged are misses. Synthetic scores prove rule coverage, not generalisation.
"""

import csv
import hashlib
import json
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

import psycopg

from integrity.auditor import Finding
from integrity.config import REPO_ROOT
from integrity.models import IssueType

SCENARIOS = ("clean", "legitimate_quote", "shared_template", "false_positive", "genuine_copy")


def truth_rows(scale: str) -> list[dict[str, str]]:
    path = REPO_ROOT / "data" / "ground_truth" / scale / "ground_truth.csv"
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def dataset_hash(scale: str) -> str:
    """SHA-256 of the dataset's manifest, which itself lists the hash of every data file."""
    return hashlib.sha256((REPO_ROOT / "data" / scale / "manifest.json").read_bytes()).hexdigest()


def _ratio(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 1.0
    value = (Decimal(numerator) / Decimal(denominator)).quantize(Decimal("0.001"), ROUND_HALF_UP)
    return float(value)


def auditor_scores(findings: list[Finding], truth: list[dict[str, str]]) -> list[dict[str, Any]]:
    """Precision, recall and F1 per issue type, with the number of labelled anomalies."""
    rows = []
    for issue in IssueType:
        labelled = {
            r["case_id"]
            for r in truth
            if r["record_type"] == "anomaly" and r["issue_type"] == issue
        }
        found = {f.case_id for f in findings if f.issue_type == issue}
        hits = len(labelled & found)
        precision, recall = _ratio(hits, len(found)), _ratio(hits, len(labelled))
        f1 = _ratio(2 * hits, len(found) + len(labelled))
        rows.append(
            {
                "issue_type": issue.value,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "labelled": len(labelled),
            }
        )
    return rows


def triage_by_scenario(
    con: psycopg.Connection[Any], truth: list[dict[str, str]]
) -> list[dict[str, Any]]:
    """Per latent scenario: flags raised, cases opened and flags auto-dismissed by the rule."""
    scenario = {r["entity_id"]: r["label"] for r in truth if r["record_type"] == "latent_scenario"}
    tally: dict[str, dict[str, Any]] = {
        name: {"scenario": name, "cases": 0, "flagged": 0, "dismissed": 0} for name in SCENARIOS
    }
    for submission_id, outcome in con.execute(
        "SELECT submission_id, outcome FROM v_flag ORDER BY submission_id"
    ).fetchall():
        row = tally[scenario[submission_id]]
        row["flagged"] += 1
        row["cases" if outcome == "case_opened" else "dismissed"] += 1
    return list(tally.values())


def evaluate(con: psycopg.Connection[Any], findings: list[Finding], scale: str) -> dict[str, Any]:
    """The AuditMetrics file content for `scale`."""
    truth = truth_rows(scale)
    return {
        "dataset_hash": dataset_hash(scale),
        "auditor": auditor_scores(findings, truth),
        "triage": triage_by_scenario(con, truth),
    }


def write_json(path: Path, payload: object) -> None:
    text = json.dumps(payload, sort_keys=True, indent=2, ensure_ascii=False) + "\n"
    path.write_bytes(text.encode("utf-8"))
