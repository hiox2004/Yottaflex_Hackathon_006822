"""Data-quality validation of the loaded database: keys, joins, dates, reconciliation, lifecycle."""

from integrity.validation.checks import Violation, run_checks
from integrity.validation.summary import render_markdown, summarize

__all__ = ["Violation", "render_markdown", "run_checks", "summarize"]
