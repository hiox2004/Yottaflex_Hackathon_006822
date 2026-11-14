"""Application factory: routers under /api, error envelope, CORS, one log line per request."""

import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from integrity.api import errors, health
from integrity.api.routers import actions, admin, audit, cases, lab, queue, reference
from integrity.config import get_settings

log = logging.getLogger("integrity.api")


async def _log_request(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    started = time.perf_counter()
    response = await call_next(request)
    elapsed = int((time.perf_counter() - started) * 1000)
    actor = request.headers.get("x-actor-id", "-")
    log.info(
        "%s %s actor=%s status=%s %dms",
        request.method,
        request.url.path,
        actor,
        response.status_code,
        elapsed,
    )
    return response


def create_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    app = FastAPI(title="Integrity Desk API", version="1.2")
    origins = [o.strip() for o in get_settings().cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"]
    )
    app.middleware("http")(_log_request)
    errors.register(app)
    app.include_router(health.router, prefix="/api")
    routers = (reference, queue, cases, actions, audit, lab, admin)
    for router in (module.router for module in routers):
        app.include_router(router, prefix="/api")
    return app
