"""Documented rules that turn a case's evidence into its decision and its appeal outcome.

These rules, not chance, drive outcomes and the expected-decision labels (brief E8).
"""

from integrity.datagen.common import d3
from integrity.datagen.plan import Item

EXPLAINING = ("quote_citation", "template_match", "learner_statement")
OVERTURN_BELOW = 850  # thousandths: a supported appeal overturns only a score below this


def evidence_kinds(item: Item, extra: str) -> list[str]:
    """Evidence kinds of a case; `extra` is the one optional kind chosen for this case."""
    if item.kind == "genuine_copy":
        return ["matched_passage", "source_reference", *([extra] if extra else [])]
    if item.variant == "bare":
        return ["matched_passage"]
    return ["matched_passage", *([extra] if extra else [])]


def case_outcome(kinds: list[str]) -> str:
    """Expected decision: a traced source confirms, any explanation clears, else inconclusive."""
    if "source_reference" in kinds:
        return "violation_confirmed"
    if any(kind in kinds for kind in EXPLAINING):
        return "no_violation"
    return "inconclusive"


def appeal_outcome(kinds: list[str], adjusted: int) -> str:
    """Expected result when an independent reviewer decides an appeal of a confirmed violation."""
    if "learner_statement" in kinds and adjusted < OVERTURN_BELOW:
        return "overturned"
    if "template_match" in kinds or "quote_citation" in kinds:
        return "partially_upheld"
    return "upheld"


def describe_evidence(kind: str, item: Item) -> str:
    texts = {
        "matched_passage": f"Matched passages make up {d3(item.raw):.3f} of the submission.",
        "source_reference": f"Matched text traces to a source (adjusted {d3(item.adjusted):.3f}).",
        "template_match": f"Part of the match ({d3(item.template):.3f}) is the shared template.",
        "quote_citation": f"Part of the match ({d3(item.quoted):.3f}) is quoted and cited.",
        "learner_statement": "The learner says the overlap is common phrasing and cited sources.",
    }
    return texts[kind]


RATIONALES = {
    "violation_confirmed": "The match is not explained by quotes or the template and has a source.",
    "no_violation": "The overlap is explained by cited or templated text, or by common phrasing.",
    "inconclusive": "The evidence does not support a finding either way.",
}
APPEAL_RATIONALES = {
    "upheld": "No new evidence changes the original finding.",
    "overturned": "The learner's statement explains the overlap, so the finding is withdrawn.",
    "partially_upheld": "Part of the overlap is quoted or templated, so the finding is reduced.",
}
APPEAL_GROUNDS = (
    "The overlapping text is common phrasing in this field.",
    "The learner believes the quoted passages were cited correctly.",
    "The learner disputes that the matched source was available to them.",
)
