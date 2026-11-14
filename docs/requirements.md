# Requirements matrix: Similarity flags, cases and appeals with due process

Source: brief.md (pasted problem statement). Pruned by hand from matrix.py output. Status: todo | PARTIAL | DONE | VERIFIED (only VERIFIED closes a row).

## A. Scope and deliverables
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| A1 | Working end-to-end solution: flags, evidence, reviewer assignment, case timeline, appeal outcome, with due process | must | VERIFIED | `test_write_endpoints.py`, React UI 5 demo beats |
| A2 | Expose key decisions and exceptions | must | VERIFIED | `action_checks`, `allowed_actions`, `explain_triage` |
| A3 | Preserve traceability (every decision traceable to rule, evidence, reviewer) | must | VERIFIED | `case_event` append-only audit log, view `v_case_status` |
| A4 | Produce measurable outputs (evaluation metrics) | must | VERIFIED | `cli eval`: Precision/Recall/F1 = 1.0; `/api/audit/metrics` |
| A5 | At least one exception path; conditional rules; multiple related entities | must | VERIFIED | G1–G4 anomalies, 409 refusals, 13 related tables |
| A6 | Deliverable: seed data (CSV/JSON/SQL) + README + schema/data dictionary + generator command + fixed seed + source manifest + validation summary | must | VERIFIED | `data/starter/*`, `data/full/manifest.json`, `DATA_DICTIONARY.md`, `validation_summary.md` |
| A7 | Deliverable: demo script (5 min) | should | VERIFIED | `docs/DEMO.md` 5-minute script with pinned case IDs |

## B. Master data (generated first)
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| B1 | Generate/reference Learner, Assessment, Submission, SimilarityReport, IntegrityRule as parents | must | VERIFIED | `database/schema.sql`, `integrity.datagen` |
| B2 | Generate child/event records only with valid parent IDs | must | VERIFIED | FK constraints in PostgreSQL, `integrity.validation` |
| B3 | Primary key on every entity (Learner, Assessment, Submission, SimilarityReport, IntegrityRule, Case, EvidenceItem, Reviewer, Decision, Appeal) | must | VERIFIED | PK constraints verified by `integrity.validation` |
| B4 | Foreign key on every relationship; bridge table for every N:M | must | VERIFIED | Bridge tables `case_reviewer`, `decision_evidence` |
| B5 | Document cardinality (1:1, 1:N, N:M), optional relationships, effective dates, lifecycle states | must | VERIFIED | `docs/DATA_DICTIONARY.md` sections 2–4 |
| B6 | Retain event history for state changes; never overwrite history | must | VERIFIED | `case_event` append-only trigger; `test_schema.py` |

## C. Data dictionary
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| C1 | Dictionary for all 10 entities: type, required/optional, allowed values, units, uniqueness, validation rule per field | must | VERIFIED | `docs/DATA_DICTIONARY.md`, tested by `test_dictionary_coverage.py` |

## D. IDs
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| D1 | Submission ID: SUB-2026-000001 (zero-padded, immutable) | must | VERIFIED | `database/schema.sql` CHECK regex, `id_sequences` check |
| D2 | Similarity report ID: SIM-<submission-id>-01 | must | VERIFIED | `database/schema.sql` CHECK regex, `id_sequences` check |
| D3 | Integrity rule ID: INT-2026-000001 | must | VERIFIED | `integrity_rule` PK format, `id_sequences` check |
| D4 | Evidence ID: EVD-<case-id>-001 | must | VERIFIED | `evidence_item` CHECK regex, `id_sequences` check |
| D5 | Appeal ID: APL-<case-id>-01 | must | VERIFIED | `appeal` CHECK regex, `id_sequences` check |
| D6 | Referenced IDs identical across all files | must | VERIFIED | `integrity.validation` 0 violations on all cross-table joins |

## E. Business logic
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| E1 | Create assessment submissions | must | VERIFIED | `datagen` produces 10,000 / 1,000 submissions |
| E2 | Generate synthetic similarity reports and evidence references | must | VERIFIED | `datagen` produces reports with boundary pins and evidence |
| E3 | Thresholds trigger REVIEW, never automatic guilt; thresholds transparent and documented | must | VERIFIED | `rules.py`, `v_flag` auto-dismissals, `test_rules.py` |
| E4 | Assign reviewers; reviewer conflict of interest must be checked | must | VERIFIED | `rules.conflict_reasons`, G2 refusal, `/cases/{id}/eligible-reviewers` |
| E5 | Capture decision and rationale for every case decision | must | VERIFIED | `decision` table requires rationale & cited evidence |
| E6 | Support appeals (independent reviewer on appeal) | must | VERIFIED | `rules.is_independent`, `appeal_service.py`, `test_write_endpoints.py` |
| E7 | Support case closure (closure only with valid lifecycle transition) | must | VERIFIED | `rules.TRANSITIONS`, `case_service.py`, `test_write_endpoints.py` |
| E8 | Documented rules drive outcomes and ground-truth labels, not independent random assignment | must | VERIFIED | `datagen/scenario.py` quota-driven generation |

## F. Volume and coverage
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| F1 | 10,000 submissions | must | VERIFIED | `data/full/manifest.json` row count = 10,000 |
| F2 | 1,000 flags (similarity flags) | must | VERIFIED | `data/full/manifest.json` row count = 1,000 |
| F3 | 300 cases | must | VERIFIED | `data/full/manifest.json` row count = 300 |
| F4 | Include legitimate quoted material, shared templates, false positives, multiple reviewers, successful appeals | must | VERIFIED | Scenario quotas verified in `metrics.json` |
| F5 | Fixed seed 20261022; starter and full datasets use the same generator with parameterized scale | must | VERIFIED | `cli datagen --scale [starter|full]`, `cli repro` |
| F6 | Realistic distributions and meaningful variation | should | VERIFIED | `data/full/validation_summary.md` distribution reports |

## G. Edge cases (labelled, injected after valid baseline)
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| G1 | Flag automatically treated as guilt (negative case: system must not do this; labelled) | must | VERIFIED | 8 full / 1 starter; detected by auditor, rejected by API |
| G2 | Reviewer has conflict (labelled; system must block or flag assignment) | must | VERIFIED | 10 full / 1 starter; detected by auditor, rejected by API |
| G3 | Evidence added after decision without history (labelled; system must record as event, not overwrite) | must | VERIFIED | 8 full / 1 starter; detected by auditor, rejected by API |
| G4 | Appeal closed without independent review (labelled; system must reject closure) | must | VERIFIED | 6 full / 1 starter; detected by auditor, rejected by API |

## H. Derived values and validation
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| H1 | Derived values (totals, scores, statuses, dates) computed from source records | must | VERIFIED | `adjusted_score` generated col, status from `v_case_status` |
| H2 | Validate: PK uniqueness, FK integrity, enums, date ordering, arithmetic reconciliation, lifecycle transitions, duplicates | must | VERIFIED | 15 checks in `integrity.validation`, 0 violations |
| H3 | Acceptance: case process preserves evidence and rationale; thresholds transparent; false positives and appeals represented; audit history complete | must | VERIFIED | Tested by full test suite and live demo pass |

## I. Ground truth
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| I1 | Separate ground_truth.csv/json for anomalies and expected decisions/labels | must | VERIFIED | `data/ground_truth/<scale>/ground_truth.csv` and `.json` |
| I2 | Ground truth never read by app code or leaked into input features | must | VERIFIED | `test_ground_truth_isolation.py` enforces module boundary |

## J. Reproducibility
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| J1 | Regenerate twice with same seed; compare row counts and checksums; show identical output | must | VERIFIED | `cli repro --scale full` yields IDENTICAL for all 16 files |

## K. Provenance
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| K1 | Synthetic data by default; any public data must record source URL, version, retrieval date, license, attribution, transformations, discarded fields | must (if used) | VERIFIED | 100% synthetic data generated, `manifest.json` `source: synthetic` |

## L. Evaluation (graded criteria in brief)
| id | requirement | kind | status | proof / citation |
|---|---|---|---|---|
| L1 | Review (a) distributions, (b) ID consistency and valid joins, (c) lifecycle consistency, (d) derived-value reconciliation, (e) normal/boundary/failure/exception coverage, (f) separate ground truth, (g) reproducibility and provenance | must | VERIFIED | `data/full/validation_summary.md` and `metrics.json` |
