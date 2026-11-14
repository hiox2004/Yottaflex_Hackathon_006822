"""Request dependencies: a database connection, the clock and the acting staff member."""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Header

from integrity import db
from integrity.clock import Clock, SystemClock
from integrity.rules import Actor
from integrity.services.common import Connection, load_actor


def get_con() -> Iterator[Connection]:
    """One connection per request. Autocommit: each write service opens its own transaction."""
    with db.connect(dict_rows=True, autocommit=True) as con:
        yield con


def get_clock() -> Clock:
    return SystemClock()


def get_actor(
    con: Annotated[Connection, Depends(get_con)],
    x_actor_id: Annotated[str | None, Header()] = None,
) -> Actor:
    """The staff member named by X-Actor-Id (401 when missing or unknown)."""
    return load_actor(con, x_actor_id)


Con = Annotated[Connection, Depends(get_con)]
Now = Annotated[Clock, Depends(get_clock)]
Who = Annotated[Actor, Depends(get_actor)]
