"""G2 reviewer conflict: assign a conflicted reviewer, and the legitimate near-miss decoys."""

import random

from integrity.datagen.common import stream
from integrity.datagen.injection import Injection, require


def _swap_reviewer(ctx: Injection, case_id: str, old: str, new: str) -> None:
    for row in ctx.rows("case_reviewer", case_id):
        if row["reviewer_id"] == old:
            row["reviewer_id"] = new
    for row in ctx.rows("decision", case_id):
        if row["reviewer_id"] == old:
            row["reviewer_id"] = new
    for event in ctx.rows("case_event", case_id):
        if event["event_type"] == "reviewer_assigned" and event["ref_id"] == old:
            event["ref_id"] = new
        if event["event_type"] == "decision_recorded" and event["actor_id"] == old:
            event["actor_id"] = new


def _staff_ids(ctx: Injection, department: str | None = None) -> list[str]:
    reviewers = ctx.tables["reviewer"]
    return sorted(
        r["reviewer_id"]
        for r in reviewers
        if r["role"] in ("instructor", "academic_reviewer")
        and department in (None, r["department"])
    )


def _prior_reviewers(ctx: Injection) -> dict[str, set[str]]:
    """learner_id -> reviewers on any of the learner's cases."""
    seen: dict[str, set[str]] = {}
    for row in ctx.tables["case_reviewer"]:
        seen.setdefault(ctx.info[row["case_id"]][0]["learner_id"], set()).add(row["reviewer_id"])
    return seen


def _conflicted_reviewer(ctx: Injection, case_id: str, variant: int, rng: random.Random) -> str:
    learner, assessment = ctx.info[case_id]
    team = {r["reviewer_id"] for r in ctx.rows("case_reviewer", case_id)}
    if variant == 0:
        options = [assessment["instructor_id"]]
    elif variant == 1:
        options = _staff_ids(ctx, learner["department"])
    else:
        options = sorted(_prior_reviewers(ctx).get(learner["learner_id"], set()))
    options = [o for o in options if o not in team]
    return rng.choice(options) if options else ""


def _decoy_reviewer(ctx: Injection, case_id: str) -> str:
    """A conflict-free reviewer of another learner's case on the same assessment."""
    learner, assessment = ctx.info[case_id]
    team = {r["reviewer_id"] for r in ctx.rows("case_reviewer", case_id)}
    earlier = _prior_reviewers(ctx).get(learner["learner_id"], set())
    others = sorted(
        {
            r["reviewer_id"]
            for r in ctx.tables["case_reviewer"]
            if r["case_id"] != case_id
            and ctx.info[r["case_id"]][1]["assessment_id"] == assessment["assessment_id"]
            and ctx.info[r["case_id"]][0]["learner_id"] != learner["learner_id"]
        }
    )
    free = [
        r
        for r in _staff_ids(ctx)
        if r in others
        and r not in team
        and r not in earlier
        and r != assessment["instructor_id"]
        and r not in _staff_ids(ctx, learner["department"])
    ]
    return free[0] if free else ""


G2_STATES = ("under_review", "decided", "closed_plain")


def reviewer_conflict(ctx: Injection, count: int) -> None:
    """G2: a conflicted reviewer is assigned. Decoy: a reviewer of another learner's case."""
    rng = stream(ctx.seed, "anomaly:g2:pick")
    found = 0
    for case_id in ctx.candidates("g2", G2_STATES):
        if found == count:
            break
        new = _conflicted_reviewer(ctx, case_id, found % 3, rng) or _conflicted_reviewer(
            ctx, case_id, 1, rng
        )
        if new:
            ctx.used.add(case_id)
            _swap_reviewer(ctx, case_id, ctx.rows("case_reviewer", case_id)[0]["reviewer_id"], new)
            ctx.label("anomaly", 1, ("case_reviewer", new), case_id, "conflicted_reviewer_assigned")
            found += 1
    require(found, count, "g2 anomalies")
    found = 0
    for case_id in ctx.candidates("g2decoy", G2_STATES):
        if found == count:
            break
        new = _decoy_reviewer(ctx, case_id)
        if new:
            ctx.used.add(case_id)
            _swap_reviewer(ctx, case_id, ctx.rows("case_reviewer", case_id)[0]["reviewer_id"], new)
            ctx.label(
                "decoy",
                1,
                ("case_reviewer", new),
                case_id,
                "reviewer_of_other_learner_same_assessment",
            )
            found += 1
    require(found, count, "g2 decoys")
