"""Injected time source: live actions use SystemClock, generation and tests use FixedClock."""

from datetime import UTC, datetime
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    """Wall clock, used only by the live API for the timestamp of a user action."""

    def now(self) -> datetime:
        return datetime.now(UTC)


class FixedClock:
    """A clock that always returns the same instant."""

    def __init__(self, instant: datetime) -> None:
        self._instant = instant

    def now(self) -> datetime:
        return self._instant
