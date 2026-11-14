"""One error envelope for every failure: {"error": {"code", "message", "details"}}."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from integrity.errors import NotFoundError, RuleViolation

log = logging.getLogger("integrity.api")
STATUS = {
    "UNKNOWN_ACTOR": 401,
    "ROLE_NOT_ALLOWED": 403,
    "NOT_YOUR_CASE": 403,
    "NOT_FOUND": 404,
    "VALIDATION_ERROR": 422,
}
CONFLICT = 409


def envelope(
    status: int, code: str, message: str, details: dict[str, Any] | None = None
) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "details": details or {}}}
    return JSONResponse(status_code=status, content=body)


def _rule_violation(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RuleViolation)
    return envelope(STATUS.get(exc.code, CONFLICT), exc.code, exc.message, exc.details)


def _not_found(_request: Request, exc: Exception) -> JSONResponse:
    return envelope(404, "NOT_FOUND", str(exc))


def _invalid_request(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    problems = [
        {"field": ".".join(str(p) for p in e["loc"]), "problem": e["msg"]} for e in exc.errors()
    ]
    return envelope(422, "VALIDATION_ERROR", "The request is not valid.", {"problems": problems})


def _unexpected(_request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled error", exc_info=exc)
    return envelope(500, "INTERNAL_ERROR", "Something went wrong on the server.")


def register(app: FastAPI) -> None:
    app.add_exception_handler(RuleViolation, _rule_violation)
    app.add_exception_handler(NotFoundError, _not_found)
    app.add_exception_handler(RequestValidationError, _invalid_request)
    app.add_exception_handler(Exception, _unexpected)
