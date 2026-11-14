# 0005. ID scheme for Case and IntegrityRule
Date: 2026-11-14 · Status: Accepted (default adopted; no objection raised)

## Context
The brief lists `SUB-2026-000001`, `SIM-<submission-id>-01`, `INT-2026-000001`, `EVD-<case-id>-001`, `APL-<case-id>-01`.
It does not say which entity `INT-` identifies. Both IntegrityRule and an "integrity case" fit. `EVD-` and `APL-` embed a
`<case-id>`, so Case needs an ID format either way.

## Decision (default until confirmed)
- `INT-2026-000001` identifies **IntegrityRule**, following the order of the entity list.
- Case uses `CAS-2026-000001`; evidence is `EVD-CAS-2026-000001-001`, appeals `APL-CAS-2026-000001-01`.
- Learner, Reviewer, Assessment and Decision get their own documented prefixes in the data dictionary.

## Alternatives considered
`INT-` as the Case ID with a new prefix for rules. Equally valid; it only changes a string.

## Consequences / revisit when
Confirm before generating the full dataset. If changed, update the data dictionary and generator constants only.
