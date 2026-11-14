"""Assemble the whole dataset in memory: master data, submissions, reports, cases, anomalies."""

from dataclasses import dataclass, replace
from datetime import UTC, datetime

from integrity import ids
from integrity.datagen import outcomes
from integrity.datagen.anomalies import inject
from integrity.datagen.cases import Builder, CaseSeed, build_case
from integrity.datagen.common import SEED, Row, Tables, after, d3, stream
from integrity.datagen.injection import Injection
from integrity.datagen.people import RULE_SWITCH, People, make_people
from integrity.datagen.plan import SCENARIO, Item, Place, make_items, place_items
from integrity.datagen.scale import Scale
from integrity.models import Rule
from integrity.rules import Scores, triage

TABLES = (
    "reviewer",
    "learner",
    "assessment",
    "integrity_rule",
    "submission",
    "similarity_report",
    "integrity_case",
    "case_reviewer",
    "evidence_item",
    "decision",
    "decision_evidence",
    "appeal",
    "case_event",
)
SORT_KEYS = {
    "reviewer": ("reviewer_id",),
    "learner": ("learner_id",),
    "assessment": ("assessment_id",),
    "integrity_rule": ("rule_id",),
    "submission": ("submission_id",),
    "similarity_report": ("similarity_report_id",),
    "integrity_case": ("case_id",),
    "case_reviewer": ("case_id", "reviewer_id"),
    "evidence_item": ("evidence_id",),
    "decision": ("decision_id",),
    "decision_evidence": ("decision_id", "evidence_id"),
    "appeal": ("appeal_id",),
    "case_event": ("occurred_at", "case_id", "_seq"),
}


@dataclass
class Dataset:
    scale: Scale
    tables: Tables
    flags: list[Row]
    truth: list[Row]


def _rule_model(row: Row) -> Rule:
    return Rule(
        rule_id=row["rule_id"],
        version=row["version"],
        log_threshold=row["log_threshold"],
        review_threshold=row["review_threshold"],
        priority_threshold=row["priority_threshold"],
        appeal_window_days=row["appeal_window_days"],
        effective_from=datetime(2026, 1, 1, tzinfo=UTC),
        effective_to=None,
    )


def _sort(tables: Tables) -> None:
    """Fixed row order (primary key, with a tiebreaker) and sequential case_event ids."""
    for name in TABLES:
        key = SORT_KEYS[name]
        tables[name].sort(key=lambda row, key=key: tuple(row[k] for k in key))  # type: ignore[misc]
    for number, event in enumerate(tables["case_event"], start=1):
        event["case_event_id"] = number


def _flags(tables: Tables, rules: dict[str, Rule]) -> list[Row]:
    learner_of = {s["submission_id"]: s["learner_id"] for s in tables["submission"]}
    rows = []
    for report in tables["similarity_report"]:
        rule = rules[report["rule_id"]]
        scores = Scores(report["raw_score"], report["quoted_score"], report["template_score"])
        result = triage(scores, rule)
        if result.is_flag:
            rows.append(
                {
                    "similarity_report_id": report["similarity_report_id"],
                    "submission_id": report["submission_id"],
                    "learner_id": learner_of[report["submission_id"]],
                    "rule_id": report["rule_id"],
                    "raw_score": scores.raw,
                    "quoted_score": scores.quoted,
                    "template_score": scores.template,
                    "adjusted_score": scores.adjusted,
                    "band": result.band.value,
                    "outcome": "case_opened" if result.opens_case else "dismissed",
                    "dismissal_reason": result.dismissal_reason.value
                    if result.dismissal_reason
                    else None,
                }
            )
    return rows


def _expected_decisions(tables: Tables) -> list[Row]:
    kinds: dict[str, list[str]] = {}
    for evidence in tables["evidence_item"]:
        kinds.setdefault(evidence["case_id"], []).append(evidence["kind"])
    return [
        {
            "record_type": "expected_decision",
            "issue_type": "",
            "entity": "decision",
            "entity_id": d["decision_id"],
            "case_id": d["case_id"],
            "label": outcomes.case_outcome(kinds[d["case_id"]]),
        }
        for d in tables["decision"]
    ]


def _submission_rows(
    seed: int, items: list[Item], places: list[Place], people: People
) -> tuple[Tables, list[CaseSeed], list[Row]]:
    """Submissions and reports in submission-time order, the case seeds, and the latent labels.

    A case seed carries its submission id in `case_id` until real case ids are numbered by time.
    """
    words, delay = stream(seed, "words"), stream(seed, "report-delay")
    order = sorted(
        range(len(items)),
        key=lambda i: (
            places[i].submitted_at,
            places[i].learner["learner_id"],
            places[i].assessment["assessment_id"],
        ),
    )
    tables: Tables = {name: [] for name in TABLES}
    pending: list[CaseSeed] = []
    truth: list[Row] = []
    for number, index in enumerate(order, start=1):
        item, place = items[index], places[index]
        sub = ids.submission_id(number)
        rule = people.rules[0] if place.submitted_at < RULE_SWITCH else people.rules[1]
        generated = after(place.submitted_at, delay, 3, 90)
        tables["submission"].append(
            {
                "submission_id": sub,
                "learner_id": place.learner["learner_id"],
                "assessment_id": place.assessment["assessment_id"],
                "attempt_no": 1,
                "submitted_at": place.submitted_at,
                "word_count": max(300, int(words.lognormvariate(7.6, 0.55))),
            }
        )
        tables["similarity_report"].append(
            {
                "similarity_report_id": ids.report_id(sub),
                "submission_id": sub,
                "rule_id": rule["rule_id"],
                "raw_score": d3(item.raw),
                "quoted_score": d3(item.quoted),
                "template_score": d3(item.template),
                "adjusted_score": d3(item.adjusted),
                "generated_at": generated,
            }
        )
        truth.append(
            {
                "record_type": "latent_scenario",
                "issue_type": "",
                "entity": "submission",
                "entity_id": sub,
                "case_id": "",
                "label": SCENARIO[item.kind],
            }
        )
        if item.status:
            opened = after(generated, delay, 1, 30)
            pending.append(
                CaseSeed(sub, ids.report_id(sub), item, place.learner, place.assessment, opened)
            )
    return tables, pending, truth


def _build_cases(builder: Builder, pending: list[CaseSeed]) -> tuple[Injection, dict[str, str]]:
    """Number the cases by opening time and step each through its lifecycle."""
    info: dict[str, tuple[Row, Row]] = {}
    states: dict[str, str] = {}
    case_of: dict[str, str] = {}
    for number, seed_case in enumerate(
        sorted(pending, key=lambda c: (c.opened_at, c.case_id)), start=1
    ):
        case = replace(seed_case, case_id=ids.case_id(number))
        build_case(builder, case)
        info[case.case_id] = (case.learner, case.assessment)
        states[case.case_id] = case.item.status
        case_of[seed_case.case_id] = case.case_id
    return Injection(builder.seed, builder.tables, info, states), case_of


def generate(scale: Scale, seed: int = SEED) -> Dataset:
    """Build the dataset for `scale`; the same seed always gives the same rows."""
    people = make_people(seed, scale)
    items = make_items(seed, scale)
    tables, pending, truth = _submission_rows(seed, items, place_items(items, people, seed), people)
    tables.update(
        reviewer=people.reviewers,
        learner=people.learners,
        assessment=people.assessments,
        integrity_rule=people.rules,
    )
    injection, case_of = _build_cases(Builder(seed, people, tables), pending)
    for row in truth:
        row["case_id"] = case_of.get(row["entity_id"], "")
    truth += _expected_decisions(tables)
    truth += inject(injection, scale.anomalies)
    _sort(tables)
    rules = {r["rule_id"]: _rule_model(r) for r in people.rules}
    ordered = sorted(truth, key=lambda r: (r["record_type"], r["issue_type"], r["entity_id"]))
    dataset = Dataset(scale, tables, _flags(tables, rules), ordered)
    _check_counts(dataset)
    return dataset


def _check_counts(dataset: Dataset) -> None:
    """The brief's exact volumes: fail loudly instead of writing a wrong dataset."""
    scale, tables = dataset.scale, dataset.tables
    cases = sum(1 for f in dataset.flags if f["outcome"] == "case_opened")
    actual = (len(tables["submission"]), len(dataset.flags), len(tables["integrity_case"]), cases)
    if actual != (scale.submissions, scale.flags, scale.cases, scale.cases):
        raise ValueError(f"volumes {actual} do not match {scale}")
