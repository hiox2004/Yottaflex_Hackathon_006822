"""The plan for every submission: latent kind, similarity scores, case end state, learner and time.

Everything comes from exact quotas (scale.py), so counts never depend on chance. Scores are integer
thousandths. Boundary scores (0.599, 0.600, 0.799, 0.800, ...) are pinned first in each kind.
"""

import random
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from integrity.datagen.common import CUTOFF, DAY, Row, stream
from integrity.datagen.people import People
from integrity.datagen.scale import Scale, kind_quotas, status_quotas

KIND_ORDER = (
    "clean",
    "legit_quote",
    "shared_template",
    "masked_quote",
    "masked_template",
    "genuine_copy",
    "false_positive",
    "copy_low",
)
SCENARIO = {  # latent scenario of each kind (the brief's five scenarios)
    "clean": "clean",
    "legit_quote": "legitimate_quote",
    "shared_template": "shared_template",
    "masked_quote": "genuine_copy",
    "masked_template": "genuine_copy",
    "copy_low": "genuine_copy",
    "genuine_copy": "genuine_copy",
    "false_positive": "false_positive",
}
HAS_CASE = ("genuine_copy", "false_positive")
APPEAL_STATES = ("appealed", "appeal_review", "appeal_decided", "closed_appeal")
# Days a case history can last from submission to its end state (the gaps in cases.py stay below).
MAX_DAYS = {
    "open": 1,
    "under_review": 6,
    "decided": 16,
    "closed_plain": 62,
    "appealed": 26,
    "appeal_review": 31,
    "appeal_decided": 47,
    "closed_appeal": 60,
}
PINS = {  # (raw, quoted, template) in thousandths
    "clean": [(599, 0, 0), (300, 0, 0), (299, 0, 0), (599, 60, 0)],
    "legit_quote": [(600, 150, 0), (700, 101, 0), (700, 150, 150)],
    "shared_template": [(700, 0, 101), (650, 0, 200)],
    "genuine_copy": [
        (600, 0, 0),
        (799, 0, 0),
        (800, 0, 0),
        (849, 0, 0),
        (850, 0, 0),
        (700, 100, 0),
    ],
    "false_positive": [(600, 0, 0), (799, 0, 0)],
}
OWN_DEPARTMENT_SHARE = 0.85
STATEMENT_SHARE = 0.2  # genuine copies where the learner also gave a statement
BARE_SHARE = 0.2  # false positives with no explanation on record (decided inconclusive)


@dataclass(frozen=True)
class Item:
    kind: str
    raw: int
    quoted: int
    template: int
    status: str = ""
    variant: str = ""

    @property
    def adjusted(self) -> int:
        return self.raw - self.quoted - self.template


@dataclass(frozen=True)
class Place:
    learner: Row
    assessment: Row
    submitted_at: datetime


def _small_exclusions(rng: random.Random) -> tuple[int, int]:
    if rng.random() < 0.25:
        return rng.randint(10, 50), rng.randint(0, 40)
    return 0, 0


def _split_exclusion(rng: random.Random, excluded: int, quote_dominant: bool) -> tuple[int, int]:
    if quote_dominant:  # quoted >= template (a tie counts as quote_only)
        template = int(rng.random() * excluded / 2)
        return excluded - template, template
    quoted = int(rng.random() * (excluded - 1) / 2)  # strictly less than half
    return quoted, excluded - quoted


def draw_scores(kind: str, rng: random.Random) -> tuple[int, int, int]:
    """(raw, quoted, template) for one submission of `kind`."""
    if kind == "clean":
        raw = int(rng.betavariate(1.3, 5) * 599)
        excluded = int(raw * rng.random() * 0.3)
        quoted = int(excluded * rng.random())
        return raw, quoted, excluded - quoted
    if kind == "copy_low":
        return rng.randint(450, 599), 0, 0
    if kind in ("genuine_copy", "false_positive"):
        quoted, template = _small_exclusions(rng)
        if kind == "genuine_copy":
            adjusted = 600 + int(rng.betavariate(1.6, 2.2) * 390)
        else:
            adjusted = rng.randint(600, 780)
        adjusted = min(adjusted, 1000 - quoted - template)
        return adjusted + quoted + template, quoted, template
    adjusted = rng.randint(450 if kind.startswith("masked") else 100, 599)
    excluded = rng.randint(max(1, 600 - adjusted), 950 - adjusted)
    quoted, template = _split_exclusion(rng, excluded, kind in ("legit_quote", "masked_quote"))
    return adjusted + excluded, quoted, template


def make_items(seed: int, scale: Scale) -> list[Item]:
    quotas = kind_quotas(scale)
    items: list[Item] = []
    for kind in KIND_ORDER:
        rng = stream(seed, f"scores:{kind}")
        scores = PINS.get(kind, [])[: quotas[kind]]
        scores += [draw_scores(kind, rng) for _ in range(quotas[kind] - len(scores))]
        items += [Item(kind, *s) for s in scores]
    return _with_end_states(items, seed, scale)


def _with_end_states(items: list[Item], seed: int, scale: Scale) -> list[Item]:
    """Give every case a target state; appeals only go to genuine copies (confirmed violations)."""
    rng = stream(seed, "status")
    quotas = status_quotas(scale.cases)
    states = [s for s in quotas for _ in range(quotas[s])]
    appeals = [s for s in states if s in APPEAL_STATES]
    others = [s for s in states if s not in APPEAL_STATES]
    genuine = [i for i, it in enumerate(items) if it.kind == "genuine_copy"]
    rng.shuffle(genuine)
    chosen = genuine[: len(appeals)]
    remaining = [i for i, it in enumerate(items) if it.kind in HAS_CASE and i not in set(chosen)]
    rng.shuffle(remaining)
    rng.shuffle(others)
    result = list(items)
    for index, state in list(zip(chosen, appeals, strict=True)) + list(
        zip(remaining, others, strict=True)
    ):
        result[index] = replace(result[index], status=state, variant=_variant(rng, items[index]))
    return result


def _variant(rng: random.Random, item: Item) -> str:
    if item.kind == "genuine_copy":
        return "statement" if rng.random() < STATEMENT_SHARE else ""
    return "bare" if rng.random() < BARE_SHARE else "explained"


def _free_learner(
    rng: random.Random, assessment: Row, people: People, used: set[tuple[str, str]]
) -> Row:
    own = [lr for lr in people.learners if lr["department"] == assessment["department"]]
    for _ in range(60):
        pool = own if rng.random() < OWN_DEPARTMENT_SHARE else people.learners
        learner = rng.choice(pool)
        if (learner["learner_id"], assessment["assessment_id"]) not in used:
            return learner
    return next(
        lr for lr in people.learners if (lr["learner_id"], assessment["assessment_id"]) not in used
    )


def place_items(items: list[Item], people: People, seed: int) -> list[Place]:
    """A learner, assessment and submission time per item; cases cluster in a few assessments."""
    rng = stream(seed, "placement")
    pool = sorted(people.assessments, key=lambda a: a["assessment_id"])
    rng.shuffle(pool)
    pool = pool[: max(6, len(pool) * 2 // 5)]
    used: set[tuple[str, str]] = set()
    places: list[Place | None] = [None] * len(items)
    order = sorted(range(len(items)), key=lambda i: (items[i].kind not in HAS_CASE, i))
    for index in order:
        item = items[index]
        candidates = pool if item.kind in HAS_CASE else people.assessments
        if item.status:
            latest = CUTOFF - timedelta(days=MAX_DAYS[item.status])
            candidates = [a for a in pool if a["due_at"] <= latest] or [
                min(pool, key=lambda a: a["due_at"])
            ]
        assessment = rng.choice(candidates)
        learner = _free_learner(rng, assessment, people, used)
        used.add((learner["learner_id"], assessment["assessment_id"]))
        submitted = assessment["due_at"] - timedelta(minutes=rng.randint(60, 14 * DAY))
        places[index] = Place(learner, assessment, submitted)
    return [p for p in places if p is not None]
