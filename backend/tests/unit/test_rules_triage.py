"""Band boundaries, triage reasons and the explanation steps."""

from datetime import date
from decimal import Decimal

import pytest

from integrity.models import Band, DismissalReason, Rule
from integrity.rules import Scores, band_for, explain_triage, triage

RULE = Rule(
    rule_id="INT-2026-000001",
    version=1,
    log_threshold=Decimal("0.30"),
    review_threshold=Decimal("0.60"),
    priority_threshold=Decimal("0.80"),
    appeal_window_days=14,
    effective_from=date(2026, 1, 1),
    effective_to=None,
)


def scores(raw: str, quoted: str = "0", template: str = "0") -> Scores:
    return Scores(Decimal(raw), Decimal(quoted), Decimal(template))


@pytest.mark.parametrize(
    ("score", "band"),
    [
        ("0.299", Band.NO_ACTION),
        ("0.300", Band.LOG_ONLY),
        ("0.599", Band.LOG_ONLY),
        ("0.600", Band.REVIEW),
        ("0.799", Band.REVIEW),
        ("0.800", Band.PRIORITY_REVIEW),
    ],
)
def test_band_edges_are_inclusive_at_the_lower_bound(score: str, band: Band) -> None:
    assert band_for(Decimal(score), RULE) is band


def test_below_review_gate_is_not_a_flag() -> None:
    result = triage(scores("0.599"), RULE)
    assert not result.is_flag
    assert not result.opens_case


def test_flag_with_reviewable_adjusted_score_opens_a_case() -> None:
    result = triage(scores("0.800", quoted="0.100"), RULE)
    assert result.opens_case
    assert result.band is Band.REVIEW


def test_adjusted_score_exactly_on_the_gate_still_opens_a_case() -> None:
    assert triage(scores("0.700", template="0.100"), RULE).opens_case


@pytest.mark.parametrize(
    ("quoted", "template", "reason"),
    [
        ("0.300", "0.100", DismissalReason.QUOTE_ONLY),
        ("0.100", "0.300", DismissalReason.TEMPLATE_MATCH),
        ("0.200", "0.200", DismissalReason.TEMPLATE_MATCH),
    ],
)
def test_dismissal_reason_is_the_larger_exclusion(
    quoted: str, template: str, reason: DismissalReason
) -> None:
    result = triage(scores("0.650", quoted, template), RULE)
    assert not result.opens_case
    assert result.dismissal_reason is reason


def test_explanation_steps_follow_the_contract_order() -> None:
    steps = explain_triage(scores("0.710", quoted="0.050", template="0.020"), RULE)
    assert [s.step for s in steps] == [
        "raw_score",
        "exclusions",
        "adjusted_score",
        "band",
        "outcome",
    ]
    assert (
        steps[0].text == "Raw score 0.710 is at or above the review gate 0.600, so this is a flag."
    )
    assert steps[-1].value == "case_opened"


def test_explanation_of_a_dismissal_names_the_reason() -> None:
    steps = explain_triage(scores("0.700", quoted="0.400"), RULE)
    assert steps[-1].value == "dismissed:quote_only"
