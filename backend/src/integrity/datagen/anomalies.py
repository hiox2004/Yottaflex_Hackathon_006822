"""Inject the four labelled anomalies (G1-G4) and their decoys into existing, valid cases.

Anomalies change rows of cases that already exist, so the counts never move and every row stays
structurally valid (the validator still passes). Each anomaly has an equal number of decoys: a
legitimate near-miss that a good auditor must not flag. Returns the ground-truth rows.
"""

from datetime import datetime, timedelta

from integrity import ids
from integrity.datagen import outcomes
from integrity.datagen.common import Row, after, stream
from integrity.datagen.injection import Injection
from integrity.datagen.reviewer_conflicts import reviewer_conflict

QUICK_DECISION_MINUTES = 5


def _auto_guilt(ctx: Injection, count: int) -> None:
    """G1: a confirmed violation recorded by the system, with no human reviewer."""
    cases = ctx.pool("g1", ("closed_plain",), 2 * count)
    for case_id in cases[:count]:
        decision = ctx.rows("decision", case_id)[0]
        decision.update(
            reviewer_id=None,
            outcome="violation_confirmed",
            rationale=outcomes.RATIONALES["violation_confirmed"],
        )
        for event in ctx.rows("case_event", case_id):
            if event["event_type"] == "decision_recorded":
                event["actor_id"] = None
        ctx.label("anomaly", 0, ("decision", decision["decision_id"]), case_id, "decided_by_system")
    for case_id in cases[count:]:
        decision = ctx.rows("decision", case_id)[0]
        _make_quick_human_decision(ctx, case_id, decision)
        ctx.label(
            "decoy", 0, ("decision", decision["decision_id"]), case_id, "quick_human_decision"
        )


def _make_quick_human_decision(ctx: Injection, case_id: str, decision: Row) -> None:
    """Decoy: a human decides five minutes after the last input and cites a single evidence item."""
    evidence = ctx.rows("evidence_item", case_id)
    cited = next((e for e in evidence if e["kind"] == "source_reference"), evidence[0])
    base = max(
        [e["added_at"] for e in evidence]
        + [r["assigned_at"] for r in ctx.rows("case_reviewer", case_id)]
    )
    decision["decided_at"] = base + timedelta(minutes=QUICK_DECISION_MINUTES)
    ctx.tables["decision_evidence"][:] = [
        r
        for r in ctx.tables["decision_evidence"]
        if r["decision_id"] != decision["decision_id"] or r["evidence_id"] == cited["evidence_id"]
    ]
    for event in ctx.rows("case_event", case_id):
        if event["event_type"] == "decision_recorded":
            event["occurred_at"] = decision["decided_at"]


def _late_evidence(ctx: Injection, count: int) -> None:
    """G3: evidence after the decision, no reopen, no event. Decoy: reopened first, with events."""
    cases = ctx.pool("g3", ("decided",), 2 * count)
    for index, case_id in enumerate(cases):
        decision = ctx.rows("decision", case_id)[0]
        existing = [e["evidence_id"] for e in ctx.rows("evidence_item", case_id)]
        reopen = index >= count
        rng = stream(ctx.seed, f"anomaly:g3:{case_id}")
        reopened_at = after(decision["decided_at"], rng, 30, 120)
        evidence = {
            "evidence_id": ids.evidence_id(case_id, ids.next_suffix(existing)),
            "case_id": case_id,
            "kind": "matched_passage",
            "description": "Further matched passage found after the decision.",
            "added_at": after(reopened_at if reopen else decision["decided_at"], rng, 30, 120),
            "added_by": decision["reviewer_id"],
        }
        ctx.tables["evidence_item"].append(evidence)
        if reopen:
            _record_reopen(ctx, case_id, decision, reopened_at, evidence)
        ctx.label(
            "decoy" if reopen else "anomaly",
            2,
            ("evidence_item", evidence["evidence_id"]),
            case_id,
            "evidence_after_reopen" if reopen else "evidence_after_decision_without_history",
        )


def _record_reopen(
    ctx: Injection, case_id: str, decision: Row, reopened_at: datetime, evidence: Row
) -> None:
    events = ctx.tables["case_event"]
    base = {
        "case_id": case_id,
        "occurred_at": reopened_at,
        "from_status": None,
        "to_status": None,
        "actor_id": decision["reviewer_id"],
        "ref_id": None,
        "reason": None,
    }
    events.append(
        {
            **base,
            "event_type": "case_reopened",
            "from_status": "decided",
            "to_status": "under_review",
            "reason": "New evidence received.",
            "_seq": 90,
        }
    )
    events.append(
        {
            **base,
            "event_type": "evidence_added",
            "occurred_at": evidence["added_at"],
            "ref_id": evidence["evidence_id"],
            "_seq": 91,
        }
    )


def _closed_without_independence(ctx: Injection, count: int) -> None:
    """G4: the appeal reviewer is not independent (sat on the case), yet the case closed."""
    cases = ctx.pool("g4", ("closed_appeal",), 2 * count)
    for index, case_id in enumerate(cases[:count]):
        appeal = ctx.rows("appeal", case_id)[0]
        team = [r["reviewer_id"] for r in ctx.rows("case_reviewer", case_id)]
        old, new = appeal["reviewer_id"], team[index % len(team)]
        appeal["reviewer_id"] = new
        for event in ctx.rows("case_event", case_id):
            if event["event_type"] == "appeal_decided" and event["actor_id"] == old:
                event["actor_id"] = new
        ctx.label(
            "anomaly",
            3,
            ("appeal", appeal["appeal_id"]),
            case_id,
            "closed_without_independent_review",
        )
    for case_id in cases[count:]:
        appeal = ctx.rows("appeal", case_id)[0]
        ctx.label("decoy", 3, ("appeal", appeal["appeal_id"]), case_id, "independent_appeal_review")


def inject(ctx: Injection, counts: tuple[int, int, int, int]) -> list[Row]:
    """Apply G1-G4 with their decoys and return the ground-truth rows."""
    _auto_guilt(ctx, counts[0])
    _closed_without_independence(ctx, counts[3])
    _late_evidence(ctx, counts[2])
    reviewer_conflict(ctx, counts[1])
    return ctx.truth
