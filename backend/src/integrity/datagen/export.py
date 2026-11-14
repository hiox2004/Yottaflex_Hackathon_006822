"""Hash-stable writers: CSV per table, dataset.json, seed.sql, manifest.json and the ground truth.

Same bytes on every machine: UTF-8 without BOM, LF line endings, fixed column order, fixed decimal
and ISO-8601 Z formats, sorted JSON keys, and no wall-clock value anywhere.
"""

import csv
import hashlib
import io
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from integrity.datagen.build import TABLES, Dataset
from integrity.datagen.common import SEED, Row

GENERATOR_VERSION = "1"
SQL_CHUNK = 500
COLUMNS: dict[str, tuple[str, ...]] = {
    "reviewer": ("reviewer_id", "name", "role", "department"),
    "learner": ("learner_id", "name", "department", "cohort_year"),
    "assessment": ("assessment_id", "title", "kind", "department", "instructor_id", "due_at"),
    "integrity_rule": (
        "rule_id",
        "name",
        "version",
        "log_threshold",
        "review_threshold",
        "priority_threshold",
        "appeal_window_days",
        "effective_from",
        "effective_to",
    ),
    "submission": (
        "submission_id",
        "learner_id",
        "assessment_id",
        "attempt_no",
        "submitted_at",
        "word_count",
    ),
    "similarity_report": (
        "similarity_report_id",
        "submission_id",
        "rule_id",
        "raw_score",
        "quoted_score",
        "template_score",
        "adjusted_score",
        "generated_at",
    ),
    "integrity_case": ("case_id", "similarity_report_id", "opened_at"),
    "case_reviewer": ("case_id", "reviewer_id", "role_in_case", "assigned_at", "assigned_by"),
    "evidence_item": ("evidence_id", "case_id", "kind", "description", "added_at", "added_by"),
    "decision": ("decision_id", "case_id", "reviewer_id", "outcome", "rationale", "decided_at"),
    "decision_evidence": ("decision_id", "evidence_id"),
    "appeal": (
        "appeal_id",
        "case_id",
        "decision_id",
        "grounds",
        "filed_at",
        "filed_by",
        "reviewer_id",
        "outcome",
        "outcome_rationale",
        "decided_at",
    ),
    "case_event": (
        "case_event_id",
        "case_id",
        "event_type",
        "from_status",
        "to_status",
        "occurred_at",
        "actor_id",
        "ref_id",
        "reason",
    ),
}
FLAG_COLUMNS = (
    "similarity_report_id",
    "submission_id",
    "learner_id",
    "rule_id",
    "raw_score",
    "quoted_score",
    "template_score",
    "adjusted_score",
    "band",
    "outcome",
    "dismissal_reason",
)
TRUTH_COLUMNS = ("record_type", "issue_type", "entity", "entity_id", "case_id", "label")
GENERATED = {"similarity_report": "adjusted_score"}  # derived by the database, so not inserted


def text(value: Any) -> str | int | None:
    """Fixed formats: ISO-8601 Z for times, three decimals for scores, None stays None."""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(value, Decimal):
        return f"{value:.3f}"
    return value  # type: ignore[no-any-return]


def _sql(value: Any) -> str:
    shown = text(value)
    if shown is None:
        return "NULL"
    if isinstance(shown, int):
        return str(shown)
    if isinstance(value, Decimal):
        return shown
    return "'" + shown.replace("'", "''") + "'"


def _write(path: Path, content: str) -> None:
    path.write_bytes(content.encode("utf-8"))  # exact bytes: no BOM, no newline translation


def _csv_text(columns: tuple[str, ...], rows: list[Row]) -> str:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow(["" if text(row[c]) is None else text(row[c]) for c in columns])
    return buffer.getvalue()


def _json_text(payload: object) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n"


def _seed_sql(tables: dict[str, list[Row]]) -> str:
    out = [
        "-- Synthetic seed data (generator version "
        + GENERATOR_VERSION
        + "). Load order follows the foreign keys."
    ]
    for name in TABLES:
        columns = tuple(c for c in COLUMNS[name] if c != GENERATED.get(name))
        rows = tables[name]
        for start in range(0, len(rows), SQL_CHUNK):
            values = ",\n".join(
                "  (" + ", ".join(_sql(r[c]) for c in columns) + ")"
                for r in rows[start : start + SQL_CHUNK]
            )
            out.append(f"INSERT INTO {name} ({', '.join(columns)}) VALUES\n{values};")
    return "\n".join(out) + "\n"


def write_dataset(dataset: Dataset, out_dir: Path, truth_dir: Path) -> dict[str, str]:
    """Write every file; returns {file name: sha256} for the files listed in the manifest."""
    out_dir.mkdir(parents=True, exist_ok=True)
    truth_dir.mkdir(parents=True, exist_ok=True)
    files: dict[str, str] = {}
    for name in TABLES:
        files[f"{name}.csv"] = _csv_text(COLUMNS[name], dataset.tables[name])
    files["flags.csv"] = _csv_text(FLAG_COLUMNS, dataset.flags)
    files["dataset.json"] = _json_text(
        {
            name: [{c: text(r[c]) for c in COLUMNS[name]} for r in dataset.tables[name]]
            for name in TABLES
        }
    )
    files["seed.sql"] = _seed_sql(dataset.tables)
    for file_name, content in files.items():
        _write(out_dir / file_name, content)
    hashes = {n: hashlib.sha256(c.encode("utf-8")).hexdigest() for n, c in sorted(files.items())}
    counts = {name: len(dataset.tables[name]) for name in TABLES} | {"flags": len(dataset.flags)}
    manifest = {
        "source": "synthetic",
        "seed": SEED,
        "scale": dataset.scale.name,
        "generator_version": GENERATOR_VERSION,
        "counts": counts,
        "sha256": hashes,
    }
    _write(out_dir / "manifest.json", _json_text(manifest))
    _write(truth_dir / "ground_truth.csv", _csv_text(TRUTH_COLUMNS, dataset.truth))
    _write(truth_dir / "ground_truth.json", _json_text({"rows": dataset.truth}))
    return hashes
