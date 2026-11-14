"""Data-quality validation of the loaded database: keys, joins, dates, reconciliation, lifecycle."""

from integrity.validation.checks import Violation, run_checks, summarize

__all__ = ["Violation", "run_checks", "summarize"]
