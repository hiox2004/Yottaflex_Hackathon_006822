# Critical review of the plan set

Reviewer pass over 00-03 against [requirements.md](../requirements.md) and the working rules. Plans were edited in place; this file
records why.

## Verdict
The original set had the right shape (deterministic core, rules written twice, decoys, append-only history) but would not have
built as written: the score scale contradicted itself, the triage rule could not produce its own dismissal reasons, the validator
would have failed on the injected anomalies, and the UI depended on an endpoint field nobody defined. Fixed below. After the edits,
every requirement row maps to a plan section; residual risk is mostly generator calibration and demo time.

## Findings
| id | sev | area | finding | resolution |
|---|---|---|---|---|
| R1 | High | scale | Q7 and unit tests use 0-1; DB used 0-100 `_pct` CHECKs; triage used `adjusted - 10`. | changed: fractions 0-1, `numeric(4,3)`, integer thousandths in datagen (HLD 4, 7; DB 1, 3; BE 4, 6) |
| R2 | High | logic | Flags defined on adjusted score, yet dismissal reasons `quote_only`/`template_match` are impossible once exclusions are subtracted. | changed: flag on raw score, case on band(adjusted), reason = larger exclusion (HLD 4) |
| R3 | High | tools | Validator checked lifecycle and replay; injected G1-G4 would make it fail, so the "validation summary" could never be green. | changed: H9 split, anomalies are structurally valid, validator must pass 100% (HLD 3, 5; BE 6, 7) |
| R4 | High | contract | FE buttons need `allowed_actions`; backend did not define it. | changed: `rules.allowed_actions`, returned on case detail and every write (BE 3, 4) |
| R5 | High | DB | `adjusted_score` CHECK ignored the rule's exclusion booleans; "derive, don't store" violated. | changed: exclusions always apply, `adjusted_score` is a generated column (DB 3) |
| R6 | Med | model | `flag` + `flag_dismissal` tables and FLG ids duplicate what the report plus rule already determine. | changed: `v_flag` view, flag id = report id (HLD H1, DB 3) |
| R7 | Med | model | `REV-SYSTEM` breaks the REV id format and leaks into pickers, conflict checks, workload. | changed: nullable `decision.reviewer_id`, API never writes NULL (DB 3) |
| R8 | Med | G2 | Decoy "same-department reviewer" contradicted the conflict rule (same department = conflict). | changed: decoy = reviewer of a different learner on the same assessment (HLD 4) |
| R9 | Med | roles | Q6 names support staff; brief lists five actors; plans had three roles and no one to file appeals. | changed: add `support_staff`, rename `academic_administrator`; platform admin = CLI operator (DB 3, BE 3, FE 1) |
| R10 | Med | API | Runtime `POST /flags/{id}/dismiss` and `/case` had no data to act on (triage is complete in datagen) and duplicated the rule. | changed: removed; `GET /flags?outcome=dismissed` read-only (BE 3, 10) |
| R11 | Med | due process | No appeal window: closing straight after a decision denies the appeal right (KB gotcha). Appeal outcome had no rationale column. | changed: `appeal_window_days` guard, `outcome_rationale`, appeal only on adverse decision (DB 3, BE 4) |
| R12 | Med | time | Generated dates could post-date live demo actions, breaking date-order checks. | changed: seed timestamps before 2026-10-22 (HLD H8, BE 6) |
| R13 | Med | repro | Windows CRLF, float formatting and git autocrlf would break checksums. | changed: hash-stable rules (HLD 7); `.gitattributes` proposed below |
| R14 | Med | eval | Auditor P/R on its own injections is ~1.0 by construction; no meaningful metric. | changed: triage vs latent scenario and decision agreement with documented noise (HLD 8, BE 6-7) |
| R15 | Med | audit | Findings served from a stale file; cannot show "app actions introduce no violations". | changed: auditor runs live; metrics file stamped with dataset hash (HLD 2, BE 7) |
| R16 | Med | errors | Role failures mapped to 409; no 401 for unknown actor. | changed: 401 `UNKNOWN_ACTOR`, 403 `ROLE_NOT_ALLOWED` (BE 3) |
| R17 | Low | L1 | No distribution review (L1a) or boundary rows (L1e). | changed: validator distribution tables, boundary rows at 0.599/0.600/0.799/0.800 (BE 6-7) |
| R18 | Low | I1 | Brief names `ground_truth.csv/json` with an issue label; plan had two other file names. | changed: `ground_truth.csv` + `.json` with `record_type`, `issue_type` (BE 6) |
| R19 | Low | load | Identity column not reset after seeded inserts; FK load order unstated; two load paths (COPY and seed.sql). | changed: seed.sql only, FK order, `setval` (DB 7) |
| R20 | Low | scale | Starter 500/50/15 cannot hold 4 anomalies + 4 decoys sensibly. | changed: starter = full / 10 (BE 6) |
| R21 | Low | rules | Rule in force judged at scan time; policy should apply at submission time (KB gotcha). | changed: rule by `submitted_at`; two rule versions (DB 3, BE 6) |
| R22 | Low | over-eng | Exclusion booleans, rescans, `count(*)+1` CAS allocator, 6 index rows, OpenAPI codegen. | changed: dropped or justified (DB 5, 10; BE 5) |
| R23 | Low | AI | AI brief had no determinism story for the demo. | changed: `LLM_MODE=replay`, never stored, faithfulness and fallback rate on 20 cases (HLD 9) |

## What we were missing (priority order)
1. A single, consistent score and triage rule (R1, R2, R5): every count, test and demo beat depends on it.
2. A validator that can pass with labelled anomalies present (R3); otherwise the acceptance story is self-contradictory.
3. A meaningful evaluation number beyond auditor-on-its-own-injections (R14), plus distributions and boundary coverage (R17).
4. The server-to-UI legality contract (`allowed_actions`, R4) and proper 401/403 (R16).
5. Due-process depth a judge will probe: appeal window, appeal rationale, adverse-only appeals, support staff role (R9, R11).
6. Determinism details: time window, hash-stable exports, CRLF (R12, R13).
7. Live auditor so the demo can prove app actions add no violations (R15).
8. Demo robustness: reset command, pinned case ids, AI replay (HLD 11).

## Requirement coverage
| req | plan section | req | plan section |
|---|---|---|---|
| A1 | HLD 4, 10; BE 3; FE 2 | E1 | BE 6 (datagen; no runtime ingest) |
| A2 | FE 2 flag panel, timeline, ErrorBanner; BE 3 codes | E2 | BE 6; DB 3 evidence_item |
| A3 | DB 3 (report rule, decision_evidence, reviewer); FE 2 | E3 | HLD 4; BE 4 band/triage; FE /rules |
| A4 | HLD 8; BE 7 eval | E4 | BE 3-4 conflict_reasons; FE picker |
| A5 | HLD 4 negative scenarios, reopen, appeal | E5 | DB 3 rationale; BE 4 guard |
| A6 | BE 6 outputs; DB 7; C1 dictionary | E6 | BE 4 is_independent; HLD 4 |
| A7 | HLD 10 step 6 (DEMO.md) | E7 | HLD lifecycle; BE 4 close guard |
| B1 | BE 6 build order (masters first) | E8 | HLD H5; BE 6 quotas + noise |
| B2 | DB 7 FK load order | F1-F3 | BE 6 Scale; validator counts |
| B3 | DB 3 | F4 | HLD 4; BE 6 scenarios, appeals, reviewers |
| B4 | DB 2-3 bridges | F5 | BE 6 Scale, seed |
| B5 | DB 2 cardinalities, rule dates, status enum | F6 | BE 6 scenarios; validator distributions |
| B6 | DB 1, 4 append-only | G1-G4 | HLD 4 table; BE 7-8 |
| C1 | DB 3 + data dictionary (HLD 10 step 2) | H1 | DB 1, generated column, views |
| D1-D5 | DB 3 id formats | H2 | DB 8 validator |
| D6 | DB 8 (CSV/JSON/SQL consistency) | H3 | HLD 8; FE /audit |
| I1 | BE 6 ground_truth.csv/json | I2 | HLD 2; BE 8 isolation test |
| J1 | HLD 7; BE 6 repro | K1 | BE 6 manifest `source: synthetic` |
| L1a-g | HLD 8; BE 7 (a distributions, b D6, c replay, d reconciliation, e boundary/G, f I1, g J1+K1) | Q1-Q8 | HLD 4 (Q1, Q3, Q7), DB 3 (Q4), BE 4 (Q5, Q6, Q8) |
Deviation: Q5 "reviewed the same submission before" is generalised to "reviewed a case of this learner" because there are no rescans.

## Changes per file
- **00-hld**: one score/flag/triage rule; G1-G4 definition table; H1 rewritten, H8 time window, H9 validator/auditor split; live
  auditor; eval beyond P/R; hash-stable export rules; observability, privacy, accessibility; AI replay.
- **01-database**: removed `flag`, `flag_dismissal`, REV-SYSTEM, rescans; fractions; generated adjusted score; roles incl. support staff;
  appeal rationale; appeal window; event types; privileges on all history tables; FK load order; trimmed indexes; views.
- **02-backend**: API reworked (401/403, allowed_actions, removed flag writes, live audit); rules table incl. triage and guards;
  datagen quotas, boundaries, noise, time window, ground_truth naming, starter scale; validator distributions.
- **03-frontend**: support staff persona, dismissed-flags tab, effective outcome, audit page contents, stale-metrics notice; open
  questions resolved.

## Proposed supersessions (outside docs/plans, not edited here)
- `database/schema.sql`: rewrite per DB plan (no flag tables, fractions, generated column, roles).
- `docs/DATA_DICTIONARY.md`: regenerate from the new schema; add a test that every schema column is documented.
- `docs/architecture.md`: replace with a pointer to 00-hld. Decisions 0004, 0005, 0009: amend (validator/auditor split; REV/LRN/ASM/DEC ids;
  seed.sql load path stays). Add `.gitattributes` with `data/** -text` (or `eol=lf`).
- Untracked draft code (`datagen/master.py`, `rules/thresholds.py`, `auditor/findings.py`, ...): reshape to the backend layout.

## Residual risks
- Hitting exactly 1,000 flags and 300 cases with realistic, boundary-including distributions needs careful quota code; test it first.
- Case status mix plus anomalies on 300 cases is tight for G4 (needs ~12 appeal cases of ~30): raise appeal rate if short.
- Auto-dismissal of 700 flags by rule may be challenged as "automated decision"; answer: favours the learner, rule-traceable.
- No reviewer unassignment and no learner right-to-respond guard; stated as limits.
- AI layer may be cut; applied-AI score then rests on explaining why AI is advisory only.

## Open questions for the user (with recommended default)
1. Should auto-dismissed flags require a human confirmation? **Default: no** (only favours the learner; state it).
2. Is "same department = conflict" (Q5) too strict for a small staff pool? **Default: keep**, generate staff across 6+ departments.
3. Appeal window length? **Default: 14 days** in `integrity_rule`.
4. Commit the full-scale data or only its manifest? **Default: manifest + validation summary only** (as decision 0009).
5. Allow reviewer removal for a late-found conflict? **Default: no** (limit stated).
6. Build the AI brief at all? **Default: only if steps 1-6 are VERIFIED by the 85% mark.**
