# Backend tab status

Updated: M1 done (14 Nov 2026) · Next: M2 17:20 (M3 18:10, M4 18:45 freeze)

## Done
- M1: `ids`, `models` (contract enums and shapes), `clock`, `errors`, pure `rules/` (`triage`, `explain_triage`, `conflicts`, `lifecycle` with `TRANSITIONS`, `check_action`, `action_checks`, `allowed_actions`, guards), CLI skeleton, 35 unit tests (boundaries 0.299..0.800, triage reasons, conflicts, independence, transitions). Draft datagen/rules removed (old schema).
- Decisions: dismissal tie (quoted == template) gives `template_match`; check order is role, then state, then specifics; no deadline for filing an appeal (limit); close from `decided` needs the window elapsed.

## Next
- M2: datagen starter + hash-stable export + `repro`; `load --scale starter`; read endpoints with v1.1 fields.

## Blocked / needs from another tab
- `schema.sql` D1 (still the old draft). `cli validate|audit` import `integrity.validation.run_checks` and `integrity.auditor.audit` (agreed interface); mypy flags both until the database tab exports them from the package `__init__`.

## Contract change requests
- `/eligible-reviewers`: non-reviewer roles (support staff, administrators) cannot decide, so assigning them strands a case. Proposal: reject them with 422 `VALIDATION_ERROR` on assignment and list them `eligible: false`; the reason code is not a `ConflictCode`. Default until answered: 422 on assignment, listed ineligible.

## Proposed shapes (by M3): `/audit/metrics`, `/audit/validation`
- not yet
