# Backend plan (FastAPI, Python 3.11+)

Implements the [HLD](00-hld.md) on the [DB plan](01-database-plan.md). The existing package tree is a draft.

## 1. Stack
FastAPI, uvicorn, Pydantic v2, `psycopg[binary,pool]` (sync, plain SQL). Dev: pytest, ruff, mypy, httpx. Everything else stdlib
(`random`, `hashlib`, `csv`, `json`, `argparse`). Sync endpoints; no ORM, no Faker, no task queue.

## 2. Layout
```
backend/src/integrity/
  ids.py         build/parse/validate SUB-, SIM-, INT-, CAS-, EVD-, DEC-, APL-, REV-, LRN-, ASM- (pure)
  models.py      enums + Pydantic models shared by all layers
  rules.py       PURE: band_for, triage, conflict_reasons, is_independent, TRANSITIONS, guards, allowed_actions
  clock.py       Clock protocol, SystemClock, FixedClock
  db.py          pool, transaction(), row helpers
  queries/       cases.py flags.py evidence.py decisions.py appeals.py events.py reviewers.py   (ALL SQL)
  services/      case_service.py appeal_service.py read_service.py
  api/           app.py errors.py deps.py routers/ (queue, cases, rules, audit, health)
  datagen/       scenarios.py build.py inject.py export.py   (only writer of ground truth)
  validation/    checks.py summary.py
  auditor/       checks.py   (never imports rules or services)
  eval/          score.py    (only reader of ground truth besides datagen)
  ai/            brief.py    (optional, last)
  cli.py         datagen | load | validate | audit | eval | repro
backend/tests/{unit,integration}
```
Files <= 300 lines, functions <= 30 statements. `api -> services -> queries -> db`; `services -> rules -> models/ids`.

## 3. API (prefix `/api`; actor via `X-Actor-Id: REV-000123`)
Roles: AR = academic_reviewer or instructor, ADM = academic_administrator, SS = support_staff.
| Method and path | Purpose | Who | Errors (409 codes) |
|---|---|---|---|
| GET `/health`, `/reviewers`, `/rules` | liveness; actor picker; thresholds and effective dates (E3) | any | |
| GET `/queue` | cases from `v_case_queue`; filters status, band, assigned_to; keyset cursor | any | 422 |
| GET `/flags?outcome=dismissed` | flags from `v_flag` with dismissal reason (read-only) | any | 422 |
| GET `/cases/{id}` | case, flag panel, evidence, decisions, appeal, assignees, **`allowed_actions` for this actor** | any | 404 |
| GET `/cases/{id}/timeline` | ordered `case_event` | any | 404 |
| GET `/cases/{id}/eligible-reviewers` | every staff member with conflict or independence verdict and reasons | any | 404 |
| POST `/cases/{id}/reviewers` | assign reviewer | ADM | `CONFLICT_OF_INTEREST` |
| POST `/cases/{id}/evidence` | add evidence (learner_statement allowed for SS) | AR assigned, SS | `REOPEN_REQUIRED`, `INVALID_TRANSITION` |
| POST `/cases/{id}/reopen` | decided -> under_review, reason | AR assigned, ADM | `INVALID_TRANSITION` |
| POST `/cases/{id}/decision` | outcome, rationale, cited evidence ids | AR assigned | `NOT_ASSIGNED`, `EVIDENCE_REQUIRED` |
| POST `/cases/{id}/appeal` | file appeal for the learner (grounds) | SS, ADM | `APPEAL_EXISTS`, `NOT_ADVERSE` |
| POST `/cases/{id}/appeal/reviewer` | assign appeal reviewer | ADM | `NOT_INDEPENDENT` |
| POST `/cases/{id}/appeal/outcome` | outcome + rationale | appeal reviewer | `NOT_APPEAL_REVIEWER` |
| POST `/cases/{id}/close` | closure (Q6) | ADM | `APPEAL_UNRESOLVED`, `APPEAL_WINDOW_OPEN`, `INVALID_TRANSITION` |
| GET `/audit/findings` | auditor run live on the DB (read-only) | any | |
| GET `/audit/metrics`, `/audit/validation` | `metrics.json` and validation summary files, with dataset hash | any | 404 if missing |
Every write body carries `expected_version`; the response is the updated case detail (new version, new `allowed_actions`).
Errors: `{"error":{"code","message","details"}}` plus `x-request-id`. Missing or unknown actor 401 `UNKNOWN_ACTOR`; wrong role 403
`ROLE_NOT_ALLOWED`; `NotFound` 404; `RuleViolation` 409 with code; stale 409 `STALE_VERSION`; Pydantic 422; unexpected 500 (logged).
There is no code path from a flag or score to a decision (G1). Learners are not actors; support staff file on their behalf.

## 4. Rules (pure, boundary-tested; scores are fractions 0-1)
| Function | Behaviour |
|---|---|
| `band_for(score, rule)` | `<log` no_action, `<review` log_only, `<priority` review, else priority_review (lower edge inclusive) |
| `triage(report, rule)` | not a flag if `raw < review`; case if `band_for(adjusted)` is review or priority; else dismissed, reason = larger of quoted/template |
| `conflict_reasons(reviewer, learner, assessment, prior_reviewers)` | instructor of the assessment; same department as the learner; already reviewed a case of this learner (Q5, generalised: no rescans) |
| `is_independent(reviewer, case)` | not on `case_reviewer`, not a decision author, no conflict reason |
| `TRANSITIONS` | `(status, action) -> status`; source for services and `allowed_actions` (validator and auditor have their own copies) |
| guards | role; decision needs assignment + rationale + >=1 cited evidence of this case; appeal only on `violation_confirmed`; evidence after a decision needs reopen; close needs resolved appeal or elapsed `appeal_window_days` |
| `allowed_actions(actor, case_ctx, now)` | actions whose transition and guards pass; the UI only renders these |
Rules take values and return values or raise `RuleViolation(code, message)`. `now` is passed in; no DB, no clock.

## 5. Service pattern
```
def decide(db, clock, actor_id, case_id, body):
    with db.transaction() as tx:
        case = cases.get_for_update(tx, case_id)          # SELECT ... FOR UPDATE
        rules.require_version(case, body.expected_version)
        rules.guard_decide(actor, case, assignees, cited, body)
        decisions.insert(tx, ...); events.insert(tx, ...)  # row and event together
        cases.set_status(tx, case_id, new_status)          # bumps version
    return read_service.case_detail(db, case_id, actor_id, clock.now())
```
Guards read fresh rows inside the transaction. Child ids (`EVD-`, `DEC-`) come from `max(suffix)+1` under the case row lock; the PK is
the backstop. No cases are created at runtime (triage happens in datagen), so `CAS-` needs no allocator.

## 6. Datagen (scenario-driven, deterministic)
- One RNG per purpose: `random.Random(f"{seed}:{purpose}")`. Scores drawn as integers 0-1000, written as `0.623`.
- `Scale(submissions, flags, cases)`: full 10,000/1,000/300; starter 1,000/100/30; same code (F5).
- Scenarios by exact quota: clean, legitimate_quote, shared_template, false_positive (cited but unmarked, common phrasing),
  genuine_copy, repeat_offender. Quotas give exactly 1,000 flags and 300 cases under the triage rule.
- Boundary rows on purpose: raw and adjusted at 0.599, 0.600, 0.799, 0.800 (L1e).
- Two rule versions (INT-2026-000001 from January, -000002 from June with a changed priority threshold); a report uses the rule in force at submission.
- Case histories built by stepping the transition table; status mix covers every state. 1-3 evidence items per case (Q4); ~25% of cases have
  two reviewers; ~12% of decided cases appealed, ~35% of those overturned or partially upheld (F4). Decisions follow the scenario with a
  documented 5% reviewer-disagreement noise, so decision agreement is not trivially 100%.
- All generated timestamps fall between 2026-01-05 and 2026-10-21 (before any live action).
- Anomalies injected after the baseline by **mutating existing cases** (counts unchanged), each structurally valid (validator passes):
  full G1 8, G2 10, G3 8, G4 6, plus the same number of decoys; starter 1 each plus 1 decoy each. Definitions: HLD section 4.
- Outputs `data/<scale>/`: one CSV per table plus `flags.csv` (from the triage rule), `dataset.json`, `seed.sql`, `manifest.json` (counts,
  SHA-256 per file, seed, generator version, `source: synthetic`, K1), `validation_summary.md`.
  Ground truth `data/ground_truth/<scale>/ground_truth.csv` and `.json` (I1): `record_type` (anomaly, decoy, expected_decision, latent_scenario),
  `issue_type` (G1-G4), entity, entity_id, case_id, label.
- Hash-stable writing per HLD section 7 (`newline=""`, LF, sorted, fixed formats). `repro` generates twice and compares (J1).

## 7. Validator, auditor, eval
| Tool | Checks | Reads |
|---|---|---|
| validator | DB plan section 8 plus distribution tables (scores, bands, outcomes, appeals, reviewers per case) for L1a; must pass 100% | DB, data files |
| auditor | G1 decision with no human or by an unassigned reviewer; G2 conflicted assignment; G3 evidence after decision without reopen or event; G4 closed after a non-independent or missing appeal review. Own transition and conflict code. | DB only |
| eval | auditor findings vs anomalies: TP/FP/FN, P/R/F1 per issue type; triage vs latent scenario (genuine copies dismissed = misses); decision agreement vs expected | findings + ground truth |
CLI `audit` writes `audit_findings.json`; `eval` writes `metrics.json` stamped with the manifest hash. API shows a warning if hashes differ.

## 8. Testing (few, at checkpoints, about 25)
Unit: ids; `band_for` at 0.299/0.300/0.599/0.600/0.799/0.800; triage reasons; conflict reasons; independence; transitions; `allowed_actions`.
Integration: one per G1-G4 (API rejects it, auditor finds the seeded one, ignores its decoy); happy path to close; stale 409; role 403;
schema loads; validator passes on starter; repro identical; no module outside datagen/eval references the ground-truth path.

## 9. Config and operations
Env: `DATABASE_URL`, `APP_ENV`, `CORS_ORIGINS`, `AI_ENABLED=false`, `LLM_MODE=replay|live`. Docker compose Postgres on host port 5433.
CLI subcommands are the only data entry points. One request log line. No background jobs.

## 10. Not doing
Auth/JWT, async, Alembic, caching, workers, event bus, rule DSL, idempotency keys, websockets, Faker, runtime flag or case creation,
manual flag dismissal (dismissal is the documented triage rule).

## 11. Open questions
Resolved: scale 0-1 (Q7); no rescans; triage simplified to one rule; generator may import `rules.TRANSITIONS` and `triage` for the baseline
(the auditor may not). Open: should auto-dismissal need a human confirmation? Default: no, it only ever favours the learner.
