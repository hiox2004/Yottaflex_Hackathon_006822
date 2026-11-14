# Data dictionary

Source of truth: [`database/schema.sql`](../database/schema.sql) (PostgreSQL 16). A test checks that every column below exists and that every column in the schema is listed. Brief rows: B, C, D, H in [requirements.md](requirements.md).

Conventions
- Timestamps are `timestamptz`, UTC. Scores are fractions from 0 to 1 with three decimals (`numeric(4,3)`, unit: share of words).
- "DB" means enforced by the database (key, `CHECK`, trigger). "Validator" means `integrity.validation`, "Auditor" means `integrity.auditor`. Due-process rules (conflicts, appeal independence, evidence after a decision) are deliberately **not** database constraints, so the labelled anomalies can load ([decision 0004](decisions/0004-where-rules-are-enforced.md)).
- The entity "Case" is the table `integrity_case` (`CASE` is an SQL keyword).
- Append-only tables (no `UPDATE`, `DELETE` or `TRUNCATE`, by trigger): `case_event`, `evidence_item`, `decision`, `decision_evidence`, `case_reviewer`, `similarity_report`, `integrity_rule`.

## 1. Id formats

Child ids embed their parent id and a `CHECK` rejects a mismatch. Ids are immutable.

| Entity | Format | Example |
|---|---|---|
| Reviewer | `REV-nnnnnn` | `REV-000011` |
| Learner | `LRN-nnnnnn` | `LRN-004213` |
| Assessment | `ASM-nnnnnn` | `ASM-000042` |
| Integrity rule | `INT-2026-nnnnnn` | `INT-2026-000001` |
| Submission | `SUB-2026-nnnnnn` | `SUB-2026-004213` |
| Similarity report | `SIM-<submission_id>-01` | `SIM-SUB-2026-004213-01` |
| Case | `CAS-2026-nnnnnn` | `CAS-2026-000017` |
| Evidence item | `EVD-<case_id>-nnn` | `EVD-CAS-2026-000017-001` |
| Decision | `DEC-<case_id>-nn` | `DEC-CAS-2026-000017-01` |
| Appeal | `APL-<case_id>-01` | `APL-CAS-2026-000017-01` |

The validator also requires evidence suffixes `001..n`, decision suffixes `01..n` and appeal suffix `-01` per case, with no gaps.

## 2. Cardinalities

| Relationship | Cardinality |
|---|---|
| Learner to Submission | 1:N |
| Assessment to Submission | 1:N |
| Reviewer (instructor) to Assessment | 1:N |
| Submission to Similarity report | 1:1 (no rescans, so the suffix is always `-01`) |
| Integrity rule to Similarity report | 1:N (the rule in force at submission time) |
| Similarity report to Case | 1:0..1 (a flag opens at most one case) |
| Case to Reviewer | N:M through `case_reviewer` |
| Case to Evidence item | 1:N (at least one is expected, not enforced) |
| Case to Decision | 1:N (reopening allows more than one) |
| Decision to Evidence item | N:M through `decision_evidence` (cited evidence) |
| Case to Appeal | 1:0..1 |
| Case to Case event | 1:N (history) |

Optional by design: `decision.reviewer_id` (NULL only in injected G1 rows), `appeal.reviewer_id` until assigned, appeal outcome fields until decided, `integrity_rule.effective_to` (NULL = current), `case_event.actor_id` (NULL = system), `evidence_item.added_by`.

## 3. Lifecycle

Case status is never stored. View `v_case_status` takes the `to_status` of the latest status-changing event. Legal transitions (checked by the validator, enforced for new actions by the API):

| Event | From | To |
|---|---|---|
| `case_opened` | none | `open` |
| `reviewer_assigned` | `open` | `under_review` (further reviewers: no status change) |
| `evidence_added` | none | none |
| `decision_recorded` | `under_review` | `decided` |
| `case_reopened` | `decided` | `under_review` |
| `appeal_filed` | `decided` | `appealed` |
| `appeal_reviewer_assigned` | `appealed` | `appeal_review` |
| `appeal_decided` | `appeal_review` | `appeal_decided` |
| `case_closed` | `decided` or `appeal_decided` | `closed` |

`case_event.ref_id` is the id of what the event is about: reviewer id (`reviewer_assigned`), evidence id, decision id, appeal id (all appeal events); NULL for `case_opened`, `case_reopened`, `case_closed`.

## 4. Tables

### reviewer
All staff. Learners are separate.
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `reviewer_id` | text | yes | `REV-nnnnnn` | primary key | DB regex |
| `name` | text | yes | synthetic name | no | DB non-blank |
| `role` | text | yes | `instructor`, `academic_reviewer`, `academic_administrator`, `support_staff` | no | DB enum |
| `department` | text | yes | free text, at least 6 departments in the data | no | DB non-blank |

### learner
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `learner_id` | text | yes | `LRN-nnnnnn` | primary key | DB regex |
| `name` | text | yes | synthetic name | no | DB non-blank |
| `department` | text | yes | free text | no | DB non-blank |
| `cohort_year` | integer | yes | year, 2000 to 2100 | no | DB range |

### assessment
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `assessment_id` | text | yes | `ASM-nnnnnn` | primary key | DB regex |
| `title` | text | yes | free text | no | DB non-blank |
| `kind` | text | yes | `essay`, `report`, `project`, `lab_report`, `coding_task` | no | DB enum |
| `department` | text | yes | free text | no | DB non-blank |
| `instructor_id` | text | yes | reviewer id | no | DB foreign key; validator: role is `instructor` |
| `due_at` | timestamptz | yes | UTC | no | none |

### integrity_rule
A rule version is never edited. A new version is inserted and the old one carries `effective_to`.
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `rule_id` | text | yes | `INT-2026-nnnnnn` | primary key | DB regex |
| `name` | text | yes | free text | no | DB non-blank |
| `version` | integer | yes | 1 or more | yes | DB range |
| `log_threshold` | numeric(4,3) | yes | fraction 0-1; seeded as 0.300 | no | DB: `log < review < priority` |
| `review_threshold` | numeric(4,3) | yes | fraction 0-1; seeded as 0.600 | no | DB: same ordering |
| `priority_threshold` | numeric(4,3) | yes | fraction 0-1; seeded as 0.800 | no | DB: same ordering |
| `appeal_window_days` | integer | yes | days, more than 0; seeded as 14 | no | DB range |
| `effective_from` | timestamptz | yes | UTC | no | validator: periods do not overlap |
| `effective_to` | timestamptz | no | NULL = current | no | DB: after `effective_from` |

### submission
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `submission_id` | text | yes | `SUB-2026-nnnnnn` | primary key | DB regex |
| `learner_id` | text | yes | learner id | with assessment and attempt | DB foreign key |
| `assessment_id` | text | yes | assessment id | with learner and attempt | DB foreign key |
| `attempt_no` | integer | yes | 1 or more; default 1 | with learner and assessment | DB range |
| `submitted_at` | timestamptz | yes | UTC | no | validator: not after the report's `generated_at` |
| `word_count` | integer | yes | words, more than 0 | no | DB range |

### similarity_report
Synthetic similarity result. One per submission.
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `similarity_report_id` | text | yes | `SIM-<submission_id>-01` | primary key | DB: equals `'SIM-' + submission_id + '-01'` |
| `submission_id` | text | yes | submission id | yes (1:1) | DB foreign key |
| `rule_id` | text | yes | rule id | no | DB foreign key; validator: rule in force at `submitted_at` |
| `raw_score` | numeric(4,3) | yes | fraction 0-1 of words matched | no | DB range |
| `quoted_score` | numeric(4,3) | yes | fraction 0-1 of properly quoted words | no | DB range |
| `template_score` | numeric(4,3) | yes | fraction 0-1 of shared-template words | no | DB range; `quoted + template <= raw` |
| `adjusted_score` | numeric(4,3) | derived | `raw - quoted - template`, generated column, never written | no | DB generated |
| `generated_at` | timestamptz | yes | UTC | no | validator: not before `submitted_at` |

### integrity_case
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `case_id` | text | yes | `CAS-2026-nnnnnn` | primary key | DB regex |
| `similarity_report_id` | text | yes | report id | yes | DB foreign key; validator: the report is a flag whose adjusted band is review or priority |
| `opened_at` | timestamptz | yes | UTC | no | validator: equals the `case_opened` event time |

### case_reviewer
Assignments are permanent history (no removal).
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `case_id` | text | yes | case id | with reviewer (primary key) | DB foreign key |
| `reviewer_id` | text | yes | reviewer id | with case (primary key) | DB foreign key; conflicts: auditor G2 |
| `role_in_case` | text | yes | `primary`, `secondary` | no | DB enum |
| `assigned_at` | timestamptz | yes | UTC | no | validator: not before `opened_at` |
| `assigned_by` | text | yes | reviewer id | no | DB foreign key |

### evidence_item
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `evidence_id` | text | yes | `EVD-<case_id>-nnn` | primary key | DB regex and case prefix |
| `case_id` | text | yes | case id | no | DB foreign key |
| `kind` | text | yes | `matched_passage`, `source_reference`, `template_match`, `quote_citation`, `learner_statement` | no | DB enum |
| `description` | text | yes | free text | no | DB non-blank; validator: no duplicate per case and kind |
| `added_at` | timestamptz | yes | UTC | no | validator: not before `opened_at`; auditor G3: not after the latest decision without a reopen |
| `added_by` | text | no | reviewer id | no | DB foreign key |

### decision
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `decision_id` | text | yes | `DEC-<case_id>-nn` | primary key | DB regex and case prefix |
| `case_id` | text | yes | case id | no | DB foreign key |
| `reviewer_id` | text | no | reviewer id; NULL only in injected G1 rows | no | DB foreign key; auditor G1 |
| `outcome` | text | yes | `no_violation`, `violation_confirmed`, `inconclusive` | no | DB enum |
| `rationale` | text | yes | free text | no | DB non-blank |
| `decided_at` | timestamptz | yes | UTC | no | validator: not before `opened_at` |

### decision_evidence
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `decision_id` | text | yes | decision id | with evidence (primary key) | DB foreign key |
| `evidence_id` | text | yes | evidence id | with decision (primary key) | DB foreign key; validator: same case, added no later than the decision |

### appeal
Mutable on purpose: the reviewer and outcome are filled in later. Each change also writes a `case_event`.
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `appeal_id` | text | yes | `APL-<case_id>-01` | primary key | DB regex and case prefix |
| `case_id` | text | yes | case id | yes (one appeal per case) | DB foreign key |
| `decision_id` | text | yes | decision id | no | DB foreign key; validator: a decision of the same case |
| `grounds` | text | yes | free text | no | DB non-blank |
| `filed_at` | timestamptz | yes | UTC | no | validator: not before the appealed decision |
| `filed_by` | text | yes | reviewer id | no | DB foreign key |
| `reviewer_id` | text | no | reviewer id, NULL until assigned | no | DB foreign key; independence: auditor G4 |
| `outcome` | text | no | `upheld`, `overturned`, `partially_upheld` | no | DB enum; outcome, rationale and `decided_at` are all NULL or all set |
| `outcome_rationale` | text | no | free text | no | DB non-blank when set |
| `decided_at` | timestamptz | no | UTC | no | validator: not before `filed_at` |

### case_event
Append-only history of every state change.
| Field | Type | Required | Allowed values and units | Unique | Validation |
|---|---|---|---|---|---|
| `case_event_id` | bigint | yes | identity, assigned in insert order | primary key | DB |
| `case_id` | text | yes | case id | no | DB foreign key |
| `event_type` | text | yes | `case_opened`, `reviewer_assigned`, `evidence_added`, `decision_recorded`, `case_reopened`, `appeal_filed`, `appeal_reviewer_assigned`, `appeal_decided`, `case_closed` | no | DB enum |
| `from_status` | text | no | a case status; NULL for non-status events and `case_opened` | no | DB enum; validator: legal pair, chain |
| `to_status` | text | no | `open`, `under_review`, `decided`, `appealed`, `appeal_review`, `appeal_decided`, `closed` | no | DB enum; `from_status` set implies `to_status` set |
| `occurred_at` | timestamptz | yes | UTC | no | validator: not before `opened_at`, in id order |
| `actor_id` | text | no | reviewer id; NULL = system | no | DB foreign key |
| `ref_id` | text | no | id of the row the event is about | no | validator: resolves within the case |
| `reason` | text | no | free text (reopen reason, close note) | no | none |

## 5. Views (derived, never stored)

| View | Columns | Meaning |
|---|---|---|
| `v_case_status` | `case_id`, `status`, `closed_at` | Latest status-changing event; `closed_at` is the time of the `case_closed` event. |
| `v_flag` | `similarity_report_id`, `submission_id`, `learner_id`, `rule_id`, `raw_score`, `quoted_score`, `template_score`, `adjusted_score`, `band`, `outcome`, `dismissal_reason` | A flag is a report with `raw_score >= review_threshold` of its rule. `band` is the band of the adjusted score. `outcome` is `case_opened` (band review or priority_review) or `dismissed`; `dismissal_reason` is the larger exclusion (`quote_only` or `template_match`, a tie counts as `quote_only`). |
| `v_case_queue` | `case_id`, `learner_id`, `learner_name`, `assessment_title`, `adjusted_score`, `band`, `status`, `closed_at`, `opened_at`, `assignee_ids`, `effective_outcome` | One row per case. `effective_outcome` is the latest decision; an `overturned` appeal gives `no_violation`, `partially_upheld` gives `inconclusive`, `upheld` keeps it. |

Bands (function `score_band`): below log threshold `no_action`, from log to below review `log_only`, from review to below priority `review`, from priority `priority_review`.
