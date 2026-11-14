# Scope cuts and team workflow

Status: accepted (user), 2026-11-14 15:40. Where this differs from plans 00-03, **this file wins**. Contract: [api-contract.md](../api-contract.md).
Deadline planned for 19:30 (stretch 20:30). Feature freeze 18:45; the last 45 minutes are for verification, README, DEMO.md and rehearsal.

## 1. Answers to the review's open questions (defaults accepted)
1. Auto-dismissed flags need no human confirmation (they only favour the learner; state it in the README).
2. "Same department = conflict" stays; generate staff across at least 6 departments.
3. Appeal window 14 days, stored on `integrity_rule`. Seeded decided cases are older than that, so the demo can close them; a case decided live cannot be closed (say so in DEMO.md).
4. Full-scale data: commit the manifest and validation summary only; starter (full / 10) is committed.
5. No reviewer removal from a case (stated limit).
6. AI brief only if M4 is verified before the freeze.

## 2. Scope cuts (replace the matching parts of plans 00-03)
| Cut | Replaced by |
|---|---|
| `expected_version`, `version`, `STALE_VERSION` | `SELECT ... FOR UPDATE` inside each write transaction; the UI refetches after every write |
| Keyset cursor | `limit` / `offset` (default 50, max 200) with a `total` |
| `x-request-id` header and request id in the UI | none; one log line per request (method, path, actor, status, ms) |
| `integrity_app` / `integrity_owner` roles and column grants | one DB user; append-only enforced by triggers |
| Stored `status`, `version`, `closed_at` on the case plus `v_case_status_replay` | status and closed_at derived from `case_event` by view `v_case_status` |
| `supersedes_decision_id`, `tool_version` | dropped |
| `repeat_offender` scenario, 5% reviewer-disagreement noise, decision-agreement metric | dropped. Scenarios: clean, legitimate_quote, shared_template, false_positive, genuine_copy |
| OpenAPI type generation | hand-written types mirroring the contract |

Kept: `v_flag` view, flag on raw score and case on the adjusted band, append-only history, four anomalies with decoys, ground truth
kept apart, live auditor, triage-versus-scenario evaluation, `allowed_actions`, 401/403 role checks, Rules page and a small Audit page.
Metrics shown on the Audit page: auditor precision/recall/F1 per issue type, triage-versus-scenario, validation summary.

## 3. Tracks, owners and milestones
| | Backend tab (owns `backend/`, `database/`, `data/`, `docs/DATA_DICTIONARY.md`) | Frontend tab (owns `frontend/`) | Time |
|---|---|---|---|
| M1 | `schema.sql` per DB plan + cuts; `cli load`; ids, models, pure rules with boundary tests | Shell cleanup, router, actor picker, API client + fixtures, Queue page on fixtures | 16:30 |
| M2 | Datagen starter (quotas, boundaries, two rules), export, validator passes, read endpoints (health, reviewers, rules, queue, flags, case, timeline, eligible-reviewers); dictionary regenerated | Case page read-only (flag panel, evidence, timeline), Rules page | 17:20 |
| M3 | Write endpoints with guards and `allowed_actions`; G1-G4 tests; full scale; `cli repro` proof | Write actions from `allowed_actions`: assign, decide, evidence, reopen, appeal, close; error states | 18:10 |
| M4 | Auditor, eval, `/audit/*`; validation summary, manifest | Audit page; switch fixtures to the live API; tests; build | 18:45 freeze |
| Final | README, DEMO.md, rehearsal, repro and CI check (orchestrator + both tabs) | | 19:30 |

## 4. Ownership and shared files
| Path | Owner |
|---|---|
| `backend/`, `database/`, `data/`, `docs/DATA_DICTIONARY.md`, `docs/status/backend.md` | backend tab |
| `frontend/`, `docs/status/frontend.md` | frontend tab |
| `docs/` (everything else), `README.md`, `.github/`, `ruff.toml`, `docker-compose.yml`, root configs | orchestrator tab (this one) |
A tab that needs a change in a path it does not own writes a request in its status file; the orchestrator makes it.

## 5. Working agreement
- **Git.** All tabs share one working tree. Commit only your own paths: `git add <paths>` then `git commit -m "..." -- <paths>` (the
  pathspec stops a commit from picking up another tab's staged files). Never `git add -A`, never `git add .`, never force-push,
  never reset or checkout files you do not own. If `index.lock` exists, wait a few seconds and retry. Pre-commit hooks must pass.
- **Database.** One Postgres (`docker compose up -d db`, port 5433). Only the backend tab runs `integrity.cli load` (it wipes
  `public`). Tests use a rolled-back scratch schema. The frontend works on fixtures until M4 and never touches the DB.
- **Contract.** `docs/api-contract.md` is frozen. Need a change? Add it under "Contract change requests" in your status file; the
  orchestrator decides, edits the contract, and notes it in both status files. Backend adds one small test that a case-detail response has the contract's keys.
- **Status.** Update your `docs/status/<tab>.md` at each milestone and when blocked: at most 15 lines (done, next, blocked, requests).
  The orchestrator reads these on request only, so keep them factual.
- **Quality.** Follow [engineering-guidelines.md](../engineering-guidelines.md): simple code, files under 300 lines, few concise
  tests run at checkpoints only (end of a milestone, before a commit that closes work), docs updated in the same change.
- **Delegation.** [Decision 0011](../decisions/0011-parallel-tabs-and-delegation.md): the tab's main model leads; Haiku subagents only for large, mechanical,
  self-verifying chunks; at most two at a time.
- **Conflicts and doubt.** Ask the orchestrator through the status file. Do not guess a contract or scope change.

## 6. State of the uncommitted backend draft (backend tab: read this)
Written before the plans existed, against an older schema (separate department, course, enrollment and flag-event tables).
- **Reuse the idea, not the file:** `rules/thresholds.py` (band, score rounding), `datagen/common.py` (per-purpose seeded streams),
  `tests/integration/conftest.py` (rolled-back scratch-schema fixture), the validator's and auditor's check list.
- **Reshape or delete:** everything else under `datagen/`, `validation/`, `auditor/`; `database/schema.sql` (rewrite per DB plan);
  `tests/integration/test_schema.py`, `test_validation.py`, `test_auditor.py` (rewrite for the new schema).
- Do not commit draft files that no longer match the plans. `git status` must be clean of leftovers before the M2 commit.

## 7. Done at the freeze (18:45)
Backend: `cli load --scale full` works from a clean DB; validator passes 100% on starter and full; `cli repro` shows identical
checksums; G1-G4 each rejected by the API and found by the auditor with its decoy ignored; CI green.
Frontend: four pages on the live API; only `allowed_actions` buttons render; lint, typecheck, tests and build pass.
Both: status files current, no leftover draft code, README quick start works from a fresh clone.
