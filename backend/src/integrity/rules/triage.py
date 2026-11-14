"""Bands, triage and the step-by-step explanation of how a report became a flag and a case."""

from dataclasses import dataclass
from decimal import Decimal

from integrity.models import Band, DismissalReason, ExplainStep, Rule


@dataclass(frozen=True)
class Scores:
    """The three scores of a similarity report, fractions 0-1 with three decimals."""

    raw: Decimal
    quoted: Decimal
    template: Decimal

    @property
    def adjusted(self) -> Decimal:
        return self.raw - self.quoted - self.template


@dataclass(frozen=True)
class Triage:
    """Outcome of triage. Never a finding of guilt: a flag only asks for human review."""

    is_flag: bool
    band: Band
    opens_case: bool
    dismissal_reason: DismissalReason | None


def band_for(score: Decimal, rule: Rule) -> Band:
    """Band of a score; the lower edge of each band is inclusive."""
    if score >= rule.priority_threshold:
        return Band.PRIORITY_REVIEW
    if score >= rule.review_threshold:
        return Band.REVIEW
    if score >= rule.log_threshold:
        return Band.LOG_ONLY
    return Band.NO_ACTION


def _is_review_band(band: Band) -> bool:
    return band in (Band.REVIEW, Band.PRIORITY_REVIEW)


def dismissal_reason(scores: Scores) -> DismissalReason:
    """The larger exclusion explains a dismissal; on a tie it is quote_only (as in v_flag)."""
    if scores.quoted >= scores.template:
        return DismissalReason.QUOTE_ONLY
    return DismissalReason.TEMPLATE_MATCH


def triage(scores: Scores, rule: Rule) -> Triage:
    """Flag when raw >= review gate; a case opens only if the adjusted score is still reviewable."""
    if scores.raw < rule.review_threshold:
        return Triage(False, band_for(scores.raw, rule), False, None)
    adjusted_band = band_for(scores.adjusted, rule)
    if _is_review_band(adjusted_band):
        return Triage(True, adjusted_band, True, None)
    return Triage(True, adjusted_band, False, dismissal_reason(scores))


def _fmt(value: Decimal) -> str:
    return f"{value:.3f}"


def _threshold_met(band: Band, rule: Rule) -> Decimal | None:
    """The gate a score reached to be in `band` (None for no_action)."""
    gates = {
        Band.PRIORITY_REVIEW: rule.priority_threshold,
        Band.REVIEW: rule.review_threshold,
        Band.LOG_ONLY: rule.log_threshold,
    }
    return gates.get(band)


def explain_triage(scores: Scores, rule: Rule) -> list[ExplainStep]:
    """Ordered plain-language steps: raw score, exclusions, adjusted score, band, outcome."""
    gate = rule.review_threshold
    result = triage(scores, rule)
    raw_text = (
        f"Raw score {_fmt(scores.raw)} is at or above the review gate {_fmt(gate)}, "
        "so this is a flag."
        if result.is_flag
        else f"Raw score {_fmt(scores.raw)} is below the review gate {_fmt(gate)}, "
        "so this is not a flag."
    )
    steps = [
        ExplainStep(step="raw_score", text=raw_text, value=float(scores.raw), threshold=float(gate))
    ]
    if not result.is_flag:
        text = "No flag, so no case and no action by a reviewer."
        return [*steps, ExplainStep(step="outcome", text=text, value="not_flagged", threshold=None)]
    excluded = scores.quoted + scores.template
    steps.append(
        ExplainStep(
            step="exclusions",
            text=(
                f"Quoted material {_fmt(scores.quoted)} and shared template text "
                f"{_fmt(scores.template)} are excluded ({_fmt(excluded)} in total)."
            ),
            value=float(excluded),
            threshold=None,
        )
    )
    adjusted_relation = "at or above" if result.opens_case else "below"
    steps.append(
        ExplainStep(
            step="adjusted_score",
            text=(
                f"Adjusted score {_fmt(scores.adjusted)} is {adjusted_relation} "
                f"the review gate {_fmt(gate)}."
            ),
            value=float(scores.adjusted),
            threshold=float(gate),
        )
    )
    met = _threshold_met(result.band, rule)
    steps.append(
        ExplainStep(
            step="band",
            text=f"The adjusted score falls in the band {result.band.value}.",
            value=result.band.value,
            threshold=None if met is None else float(met),
        )
    )
    steps.append(_outcome_step(result))
    return steps


def _outcome_step(result: Triage) -> ExplainStep:
    if result.opens_case:
        text = "A case is opened for human review. No decision is made automatically."
        return ExplainStep(step="outcome", text=text, value="case_opened", threshold=None)
    reason = result.dismissal_reason.value if result.dismissal_reason else ""
    text = (
        f"Auto-dismissed ({reason}): exclusions explain the overlap, "
        "which only favours the learner."
    )
    return ExplainStep(step="outcome", text=text, value=f"dismissed:{reason}", threshold=None)
