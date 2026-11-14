"""Seeded random streams and small helpers shared by the generator modules."""

import hashlib
import random
from datetime import UTC, datetime, timedelta
from typing import Any

SEED = 20261022
Row = dict[str, Any]
Tables = dict[str, list[Row]]


def stream(seed: int, purpose: str) -> random.Random:
    """One independent random stream per purpose, so changing one part never reshuffles another."""
    digest = hashlib.sha256(f"{seed}:{purpose}".encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))  # noqa: S311 (seeded data, not security)


def moment(year: int, month: int, day: int, hour: int = 0) -> datetime:
    return datetime(year, month, day, hour, tzinfo=UTC)


def later(when: datetime, rng: random.Random, low: int, high: int) -> datetime:
    """A time between `low` and `high` minutes after `when`."""
    return when + timedelta(minutes=rng.randint(low, high))
