# Backend tab status

Updated: M2 done (14 Nov 2026). M3 and M4 code is in the working tree but not committed under this tab's status (check `git status`). Freeze 18:45

## Done
- M1: ids, models, pure rules (`explain_triage`, `action_checks`, guards), unit tests. Orchestrator decisions 2 and 3 applied (tie = `quote_only`; `ROLE_CANNOT_REVIEW` gives 422 `VALIDATION_ERROR`).
- M2: datagen (quota-driven kinds, boundary pins, G1-G4 plus decoys) with hash-stable export and `repro`. Starter 1,000/100/30 and full 10,000/1,000/300 load; validator 0 violations; auditor finds exactly 4 (starter) and 8/10/8/6 (full). `repro` identical across `PYTHONHASHSEED` values.
- Read endpoints with v1.2 fields (counts, `needs_my_action` filter), error envelope, actor stub, one log line per request. API tests run the starter data in a rolled-back scratch schema.
- Schema facts accepted: `assessment.kind` values and the `effective_outcome` mapping.

## Next
- M3 written: write endpoints and guards, G1-G4 API tests (`tests/api/test_write_endpoints.py`), `/audit/*` routes, eval package. Still to check: full pytest, ruff, mypy, `simplify`, `security-review`.

## Blocked / needs from another tab
- none

## Contract change requests
- none. Note: `GET /reviewers` works without `X-Actor-Id` (the UI needs it to pick an actor); every other endpoint except `/health` requires it.

## Audit shapes: `/audit/metrics`, `/audit/validation`
- Final shapes are in the contract (v1.3). Implementation is in the working tree; not re-verified in this pass.
