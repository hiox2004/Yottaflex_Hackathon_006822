"""Case histories: each case is stepped through the lifecycle until its target state.

Every step writes the row and its case_event together, with conflict-free reviewers, evidence before
the decision and an independent appeal reviewer, so the baseline holds no due-process defect.
The anomalies are injected afterwards (anomalies.py).
"""

import random
from dataclasses import dataclass, field
from datetime import datetime

from integrity import ids
from integrity.datagen import outcomes
from integrity.datagen.common import DAY, Row, Tables, after, stream
from integrity.datagen.people import People
from integrity.datagen.plan import Item

MILESTONES = {  # target state -> the milestones it passes, in order
    "open": (),
    "under_review": ("assigned",),
    "decided": ("assigned", "decided"),
    "closed_plain": ("assigned", "decided", "closed"),
    "appealed": ("assigned", "decided", "appealed"),
    "appeal_review": ("assigned", "decided", "appealed", "appeal_review"),
    "appeal_decided": ("assigned", "decided", "appealed", "appeal_review", "appeal_decided"),
    "closed_appeal": (
        "assigned",
        "decided",
        "appealed",
        "appeal_review",
        "appeal_decided",
        "closed",
    ),
}
SECOND_REVIEWER_SHARE = 0.25


@dataclass(frozen=True)
class CaseSeed:
    case_id: str
    report_id: str
    item: Item
    learner: Row
    assessment: Row
    opened_at: datetime


@dataclass
class EventLog:
    """The case_event rows of one case, in the order they happen."""

    case_id: str
    rows: list[Row] = field(default_factory=list)

    def add(
        self,
        kind: str,
        at: datetime,
        actor: str | None = None,
        ref: str | None = None,
        change: tuple[str | None, str] | None = None,
    ) -> None:
        """Status-changing events carry (from, to); the others leave both empty."""
        before, to = change if change else (None, None)
        self.rows.append(
            {
                "case_id": self.case_id,
                "event_type": kind,
                "occurred_at": at,
                "from_status": before,
                "to_status": to,
                "actor_id": actor,
                "ref_id": ref,
                "reason": None,
                "_seq": len(self.rows),
            }
        )


@dataclass
class Builder:
    seed: int
    people: People
    tables: Tables
    learner_reviewers: dict[str, set[str]] = field(default_factory=dict)

    def pick_reviewer(self, rng: random.Random, case: CaseSeed, exclude: set[str]) -> str:
        """A reviewer with no conflict of interest and no earlier case of this learner."""
        used = self.learner_reviewers.setdefault(case.learner["learner_id"], set())
        pool = self.people.staff("instructor") + self.people.staff("academic_reviewer")
        candidates = sorted(
            r["reviewer_id"]
            for r in pool
            if r["department"] != case.learner["department"]
            and r["reviewer_id"] != case.assessment["instructor_id"]
            and r["reviewer_id"] not in used | exclude
        )
        chosen: str = rng.choice(candidates)
        used.add(chosen)
        return chosen


def _extra_kind(rng: random.Random, item: Item) -> str:
    """The one optional evidence kind of a case (empty when the case has none)."""
    if item.kind != "genuine_copy":
        return rng.choice(("quote_citation", "template_match", "learner_statement"))
    if item.variant == "statement":
        return "learner_statement"
    if item.template and item.template >= item.quoted:
        return "template_match"
    return "quote_citation" if item.quoted else ""


def _add_evidence(b: Builder, rng: random.Random, case: CaseSeed, log: EventLog) -> list[Row]:
    kinds = outcomes.evidence_kinds(case.item, _extra_kind(rng, case.item))
    support = b.people.staff("support_staff")
    rows, cursor = [], case.opened_at
    for number, kind in enumerate(kinds, start=1):
        cursor = after(cursor, rng, 1, 15)
        statement = kind == "learner_statement"
        added_at = after(case.opened_at, rng, 60, 30 * 60) if statement else cursor
        author: str | None = rng.choice(support)["reviewer_id"] if statement else None
        row = {
            "evidence_id": ids.evidence_id(case.case_id, number),
            "case_id": case.case_id,
            "kind": kind,
            "description": outcomes.describe_evidence(kind, case.item),
            "added_at": added_at,
            "added_by": author,
        }
        rows.append(row)
        log.add("evidence_added", added_at, author, str(row["evidence_id"]))
    return rows


def _assign(b: Builder, rng: random.Random, case: CaseSeed, log: EventLog) -> list[Row]:
    admin = rng.choice(b.people.staff("academic_administrator"))["reviewer_id"]
    first_at = after(case.opened_at, rng, 120, 72 * 60)
    team = [(b.pick_reviewer(rng, case, set()), "primary", first_at)]
    if rng.random() < SECOND_REVIEWER_SHARE:
        second = b.pick_reviewer(rng, case, {team[0][0]})
        team.append((second, "secondary", after(first_at, rng, 60, DAY)))
    rows = []
    for index, (reviewer, role, at) in enumerate(team):
        rows.append(
            {
                "case_id": case.case_id,
                "reviewer_id": reviewer,
                "role_in_case": role,
                "assigned_at": at,
                "assigned_by": admin,
            }
        )
        log.add(
            "reviewer_assigned",
            at,
            admin,
            reviewer,
            ("open", "under_review") if index == 0 else None,
        )
    return rows


def _decide(
    rng: random.Random, case: CaseSeed, team: list[Row], evidence: list[Row], log: EventLog
) -> Row:
    base = max(max(e["added_at"] for e in evidence), max(r["assigned_at"] for r in team))
    outcome = outcomes.case_outcome([e["kind"] for e in evidence])
    row = {
        "decision_id": ids.decision_id(case.case_id, 1),
        "case_id": case.case_id,
        "reviewer_id": team[0]["reviewer_id"],
        "outcome": outcome,
        "rationale": outcomes.RATIONALES[outcome],
        "decided_at": after(base, rng, DAY, 9 * DAY),
    }
    log.add(
        "decision_recorded",
        row["decided_at"],
        row["reviewer_id"],
        row["decision_id"],
        ("under_review", "decided"),
    )
    return row


def _appeal(
    b: Builder,
    rng: random.Random,
    case: CaseSeed,
    decision: Row,
    context: tuple[tuple[str, ...], list[Row], list[Row], EventLog],
) -> Row:
    steps, team, evidence, log = context
    admin = team[0]["assigned_by"]
    filed = after(decision["decided_at"], rng, DAY, 10 * DAY)
    support = rng.choice(b.people.staff("support_staff"))["reviewer_id"]
    row = {
        "appeal_id": ids.appeal_id(case.case_id),
        "case_id": case.case_id,
        "decision_id": decision["decision_id"],
        "grounds": rng.choice(outcomes.APPEAL_GROUNDS),
        "filed_at": filed,
        "filed_by": support,
        "reviewer_id": None,
        "outcome": None,
        "outcome_rationale": None,
        "decided_at": None,
    }
    log.add("appeal_filed", filed, support, row["appeal_id"], ("decided", "appealed"))
    last = filed
    if "appeal_review" in steps:
        row["reviewer_id"] = b.pick_reviewer(rng, case, {r["reviewer_id"] for r in team})
        last = after(filed, rng, DAY, 4 * DAY)
        log.add(
            "appeal_reviewer_assigned", last, admin, row["appeal_id"], ("appealed", "appeal_review")
        )
    if "appeal_decided" in steps:
        result = outcomes.appeal_outcome([e["kind"] for e in evidence], case.item.adjusted)
        last = after(last, rng, 3 * DAY, 18 * DAY)
        row.update(
            outcome=result, outcome_rationale=outcomes.APPEAL_RATIONALES[result], decided_at=last
        )
        log.add(
            "appeal_decided",
            last,
            row["reviewer_id"],
            row["appeal_id"],
            ("appeal_review", "appeal_decided"),
        )
    return row


def _close(
    rng: random.Random, team: list[Row], appeal: Row | None, decision: Row, log: EventLog
) -> None:
    """Close after the 14-day appeal window, or shortly after the appeal outcome."""
    if appeal is None:
        at, origin = after(decision["decided_at"], rng, 15 * DAY, 45 * DAY), "decided"
    else:
        at, origin = after(appeal["decided_at"], rng, DAY, 10 * DAY), "appeal_decided"
    log.add("case_closed", at, team[0]["assigned_by"], None, (origin, "closed"))


def build_case(b: Builder, case: CaseSeed) -> None:
    """Append the case, its reviewers, evidence, decision, appeal and events to the tables."""
    rng = stream(b.seed, f"case:{case.case_id}")
    steps = MILESTONES[case.item.status]
    log = EventLog(case.case_id)
    log.add("case_opened", case.opened_at, change=(None, "open"))
    evidence = _add_evidence(b, rng, case, log)
    team = _assign(b, rng, case, log) if steps else []
    t = b.tables
    t["integrity_case"].append(
        {
            "case_id": case.case_id,
            "similarity_report_id": case.report_id,
            "opened_at": case.opened_at,
        }
    )
    t["evidence_item"] += evidence
    t["case_reviewer"] += team
    if "decided" in steps:
        decision = _decide(rng, case, team, evidence, log)
        t["decision"].append(decision)
        t["decision_evidence"] += [
            {"decision_id": decision["decision_id"], "evidence_id": e["evidence_id"]}
            for e in evidence
        ]
        appeal = (
            _appeal(b, rng, case, decision, (steps, team, evidence, log))
            if "appealed" in steps
            else None
        )
        if appeal:
            t["appeal"].append(appeal)
        if "closed" in steps:
            _close(rng, team, appeal, decision, log)
    t["case_event"] += log.rows
