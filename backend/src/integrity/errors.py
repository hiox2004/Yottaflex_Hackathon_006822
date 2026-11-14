"""Domain errors shared by rules, services and the API error envelope."""

from typing import Any


class RuleViolation(Exception):
    """A business rule refused an action. `code` is one of the contract's 409 error codes."""

    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


class NotFoundError(Exception):
    """The requested case, reviewer or file does not exist."""
