# 0004. Structural rules in the database, business rules in code
Date: 2026-11-14 · Status: Accepted

## Context
The brief requires labelled anomalies injected into otherwise valid data: automatic guilt, a conflicted reviewer,
evidence added after a decision without history, an appeal closed without independent review. If the database
itself forbade these, the injected rows could not be loaded.

## Decision
- **Database (PostgreSQL):** primary and foreign keys, enums and `CHECK`s, `NOT NULL`, and the append-only `case_event`
  table (no `UPDATE`/`DELETE`, enforced by privileges and a trigger).
- **Service layer:** business rules (conflict of interest, independent appeal review, evidence-after-decision requires
  a reopen event, closure only via a valid lifecycle transition), enforced for every new action through the API.
- **Auditor:** an independent implementation of the same rules, run over loaded data, to detect the injected anomalies.

## Why
Keeps structure guaranteed and history tamper-resistant while still letting the dataset contain known violations.
The auditor is written independently from the spec so its metrics are not graded against its own logic.

## Consequences / revisit when
Rules live in two places (service and auditor), so each needs its own tests, and the generator includes decoys
(near-misses that are legitimate) so precision and recall are meaningful.
