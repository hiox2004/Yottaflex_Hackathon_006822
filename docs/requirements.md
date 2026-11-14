# Requirements matrix: Similarity flags, cases and appeals with due process

Source: brief.md (pasted problem statement). Pruned by hand from matrix.py output. Status: todo | PARTIAL | DONE | VERIFIED (only VERIFIED closes a row).

## A. Scope and deliverables
| id | requirement | kind | status |
|---|---|---|---|
| A1 | Working end-to-end solution: flags, evidence, reviewer assignment, case timeline, appeal outcome, with due process | must | todo |
| A2 | Expose key decisions and exceptions | must | todo |
| A3 | Preserve traceability (every decision traceable to rule, evidence, reviewer) | must | todo |
| A4 | Produce measurable outputs (evaluation metrics) | must | todo |
| A5 | At least one exception path; conditional rules; multiple related entities | must | todo |
| A6 | Deliverable: seed data (CSV/JSON/SQL) + README + schema/data dictionary + generator command + fixed seed + source manifest + validation summary | must | todo |
| A7 | Deliverable: demo script (5 min) | should | todo |

## B. Master data (generated first)
| id | requirement | kind | status |
|---|---|---|---|
| B1 | Generate/reference Learner, Assessment, Submission, SimilarityReport, IntegrityRule as parents | must | todo |
| B2 | Generate child/event records only with valid parent IDs | must | todo |
| B3 | Primary key on every entity (Learner, Assessment, Submission, SimilarityReport, IntegrityRule, Case, EvidenceItem, Reviewer, Decision, Appeal) | must | todo |
| B4 | Foreign key on every relationship; bridge table for every N:M | must | todo |
| B5 | Document cardinality (1:1, 1:N, N:M), optional relationships, effective dates, lifecycle states | must | todo |
| B6 | Retain event history for state changes; never overwrite history | must | todo |

## C. Data dictionary
| id | requirement | kind | status |
|---|---|---|---|
| C1 | Dictionary for all 10 entities: type, required/optional, allowed values, units, uniqueness, validation rule per field | must | todo |

## D. IDs
| id | requirement | kind | status |
|---|---|---|---|
| D1 | Submission ID: SUB-2026-000001 (zero-padded, immutable) | must | todo |
| D2 | Similarity report ID: SIM-<submission-id>-01 | must | todo |
| D3 | Integrity rule ID: INT-2026-000001 | must | todo |
| D4 | Evidence ID: EVD-<case-id>-001 | must | todo |
| D5 | Appeal ID: APL-<case-id>-01 | must | todo |
| D6 | Referenced IDs identical across all files | must | todo |

## E. Business logic
| id | requirement | kind | status |
|---|---|---|---|
| E1 | Create assessment submissions | must | todo |
| E2 | Generate synthetic similarity reports and evidence references | must | todo |
| E3 | Thresholds trigger REVIEW, never automatic guilt; thresholds transparent and documented | must | todo |
| E4 | Assign reviewers; reviewer conflict of interest must be checked | must | todo |
| E5 | Capture decision and rationale for every case decision | must | todo |
| E6 | Support appeals (independent reviewer on appeal) | must | todo |
| E7 | Support case closure (closure only with valid lifecycle transition) | must | todo |
| E8 | Documented rules drive outcomes and ground-truth labels, not independent random assignment | must | todo |

## F. Volume and coverage
| id | requirement | kind | status |
|---|---|---|---|
| F1 | 10,000 submissions | must | todo |
| F2 | 1,000 flags (similarity flags) | must | todo |
| F3 | 300 cases | must | todo |
| F4 | Include legitimate quoted material, shared templates, false positives, multiple reviewers, successful appeals | must | todo |
| F5 | Fixed seed 20261022; starter and full datasets use the same generator with parameterized scale | must | todo |
| F6 | Realistic distributions and meaningful variation | should | todo |

## G. Edge cases (labelled, injected after valid baseline)
| id | requirement | kind | status |
|---|---|---|---|
| G1 | Flag automatically treated as guilt (negative case: system must not do this; labelled) | must | todo |
| G2 | Reviewer has conflict (labelled; system must block or flag assignment) | must | todo |
| G3 | Evidence added after decision without history (labelled; system must record as event, not overwrite) | must | todo |
| G4 | Appeal closed without independent review (labelled; system must reject closure) | must | todo |

## H. Derived values and validation
| id | requirement | kind | status |
|---|---|---|---|
| H1 | Derived values (totals, scores, statuses, dates) computed from source records | must | todo |
| H2 | Validate: PK uniqueness, FK integrity, enums, date ordering, arithmetic reconciliation, lifecycle transitions, duplicates | must | todo |
| H3 | Acceptance: case process preserves evidence and rationale; thresholds transparent; false positives and appeals represented; audit history complete | must | todo |

## I. Ground truth
| id | requirement | kind | status |
|---|---|---|---|
| I1 | Separate ground_truth.csv/json for anomalies and expected decisions/labels | must | todo |
| I2 | Ground truth never read by app code or leaked into input features | must | todo |

## J. Reproducibility
| id | requirement | kind | status |
|---|---|---|---|
| J1 | Regenerate twice with same seed; compare row counts and checksums; show identical output | must | todo |

## K. Provenance
| id | requirement | kind | status |
|---|---|---|---|
| K1 | Synthetic data by default; any public data must record source URL, version, retrieval date, license, attribution, transformations, discarded fields | must (if used) | todo |

## L. Evaluation (graded criteria in brief)
| id | requirement | kind | status |
|---|---|---|---|
| L1 | Review (a) distributions, (b) ID consistency and valid joins, (c) lifecycle consistency, (d) derived-value reconciliation, (e) normal/boundary/failure/exception coverage, (f) separate ground truth, (g) reproducibility and provenance | must | todo |

## Ambiguity log
| # | question | default we build | cost if wrong | changes a number? |
|---|---|---|---|---|
| Q1 | Is a "flag" the same as a SimilarityReport above threshold, or a separate record? | Flag = SimilarityReport whose score >= review threshold; 1,000 flags are a subset of the 10,000 submissions' reports | high | yes |
| Q2 | Is the primary deliverable the data generator, the working app, or both? | Both: generator produces data; app loads it and runs the case workflow | high | no |
| Q3 | Are the 300 cases a subset of the 1,000 flags? | Yes: each case is opened from one flag; flags below the review gate are auto-dismissed | med | yes |
| Q4 | How many evidence items per case, appeals per case? | 1-3 evidence items per case; at most one appeal per case (APL-<case>-01) | med | yes |
| Q5 | What is a reviewer conflict? | Reviewer is the submitting learner's instructor or same department, or reviewed the same submission before | med | no |
| Q6 | Who may close a case? | Academic administrator only; support staff cannot close | low | no |
| Q7 | Exact threshold values | Score bands: <0.30 no action, 0.30-0.59 log only, 0.60-0.79 review, >=0.80 priority review. Never automatic finding of guilt | med | yes |
| Q8 | Outcome after appeal | One of: upheld, overturned, partially_upheld; closed only after independent review | low | no |

## Assumptions
- Synthetic data only. No public data used.
- Dates are in 2026; timestamps are UTC.
- Scale parameter: starter = small slice (e.g. 500 submissions), full = 10,000 submissions, same generator.

## Out of scope (for now)
- Real plagiarism detection; the similarity score is synthetic.
- Authentication and real user accounts (roles are attributes on Reviewer/Learner only).
- Production UI polish; minimal UI only after data and rules are VERIFIED.
