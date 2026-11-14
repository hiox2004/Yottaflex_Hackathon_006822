"""Seeded random streams, fixed time bounds and small helpers shared by the generator modules."""

import hashlib
import random
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

SEED = 20261022
START = datetime(2026, 1, 5, tzinfo=UTC)
CUTOFF = datetime(
    2026, 10, 21, 23, 59, tzinfo=UTC
)  # no generated event is later; live actions follow
Row = dict[str, Any]
Tables = dict[str, list[Row]]


def stream(seed: int, purpose: str) -> random.Random:
    """One independent random stream per purpose, so changing one part never reshuffles another."""
    digest = hashlib.sha256(f"{seed}:{purpose}".encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


def d3(thousandths: int) -> Decimal:
    """Exact score from integer thousandths: 623 -> Decimal('0.623')."""
    return Decimal(thousandths).scaleb(-3)


def after(when: datetime, rng: random.Random, low_minutes: int, high_minutes: int) -> datetime:
    """A time between `low_minutes` and `high_minutes` after `when`."""
    return when + timedelta(minutes=rng.randint(low_minutes, high_minutes))


DAY = 24 * 60  # minutes
