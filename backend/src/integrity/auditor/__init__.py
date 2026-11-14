"""Independent due-process auditor: reads the database only, never imports rules or datagen."""

from integrity.auditor.findings import Finding, audit

__all__ = ["Finding", "audit"]
