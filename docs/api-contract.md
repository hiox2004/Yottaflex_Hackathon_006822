# API contract v1.3 (frozen)

Owned by the orchestrator tab. Backend implements it, frontend consumes it. Changes only through a status-file request
([05-scope-and-workflow.md](plans/05-scope-and-workflow.md) section 5). Scope cuts there apply: no versions, no cursors, no request ids.

## Conventions
- Base path `/api`, JSON in and out, UTF-8. Timestamps are ISO-8601 UTC strings (`2026-03-04T10:15:00Z`). Scores are JSON numbers
  from 0 to 1 with three decimals (`0.623`). IDs are the brief's formats (`CAS-2026-000017`, `EVD-CAS-2026-000017-001`, ...).
- Actor stub: header `X-Actor-Id: REV-000011` on every request except `GET /health`. Unknown id: 401. Wrong role: 403.
- Errors: HTTP status plus `{"error": {"code": "CONFLICT_OF_INTEREST", "message": "Plain-language text", "details": {}}}`.
- Writes return the updated `CaseDetail` (200). Pagination: `limit` (default 50, max 200) and `offset`; lists return `{"items": [...], "total": n}`. `GET /queue` accepts `status` as a comma-separated list (`status=open,under_review`).
- Every write runs in one transaction and also writes a `case_event`.
- Assigning a support-staff or administrator account as a case reviewer is refused with 422 `VALIDATION_ERROR` (`details.reasons` contains `ROLE_CANNOT_REVIEW`);
  such accounts appear in `eligible-reviewers` with `eligible: false` and that reason.

## Enums (snake_case strings)
| Name | Values |
|---|---|
| role | `instructor`, `academic_reviewer`, `academic_administrator`, `support_staff` |
| band | `no_action`, `log_only`, `review`, `priority_review` |
| status | `open`, `under_review`, `decided`, `appealed`, `appeal_review`, `appeal_decided`, `closed` |
| evidence kind | `matched_passage`, `source_reference`, `template_match`, `quote_citation`, `learner_statement` |
| decision outcome | `no_violation`, `violation_confirmed`, `inconclusive` |
| appeal outcome | `upheld`, `overturned`, `partially_upheld` |
| event_type | `case_opened`, `reviewer_assigned`, `evidence_added`, `decision_recorded`, `case_reopened`, `appeal_filed`, `appeal_reviewer_assigned`, `appeal_decided`, `case_closed` |
| dismissal_reason | `quote_only`, `template_match` (the larger exclusion; a tie counts as `quote_only`) |
| issue_type | `AUTO_GUILT_WITHOUT_REVIEW`, `REVIEWER_CONFLICT`, `EVIDENCE_AFTER_DECISION_NO_HISTORY`, `APPEAL_CLOSED_NO_INDEPENDENT_REVIEW` |
| allowed action | `assign_reviewer`, `add_evidence`, `reopen`, `decide`, `file_appeal`, `assign_appeal_reviewer`, `decide_appeal`, `close` |
| conflict reason code | `INSTRUCTOR_OF_ASSESSMENT`, `SAME_DEPARTMENT`, `REVIEWED_LEARNER_BEFORE`, `ALREADY_ON_CASE`, `DECIDED_THIS_CASE`, `ROLE_CANNOT_REVIEW` |
| error codes | `UNKNOWN_ACTOR`(401), `ROLE_NOT_ALLOWED`(403), `NOT_FOUND`(404), `CONFLICT_OF_INTEREST`, `NOT_INDEPENDENT`, `REOPEN_REQUIRED`, `INVALID_TRANSITION`, `NOT_ASSIGNED`, `EVIDENCE_REQUIRED`, `APPEAL_EXISTS`, `NOT_ADVERSE`, `NOT_APPEAL_REVIEWER`, `APPEAL_UNRESOLVED`, `APPEAL_WINDOW_OPEN` (all 409), `VALIDATION_ERROR`(422) |

## Endpoints
| Method and path | Purpose | Roles | Body | Response |
|---|---|---|---|---|
| GET `/health` | liveness, no actor needed | any | | `{"status":"ok","database":"up"}` |
| GET `/reviewers` | actor picker | any | | `Reviewer[]` |
| GET `/rules` | rule versions | any | | `Rule[]` |
| GET `/queue?status=&band=&assigned_to=&needs_my_action=&limit=&offset=` | cases, newest first | any | | `{items: QueueRow[], total, counts: QueueCounts}` |
| GET `/flags?outcome=dismissed&limit=&offset=` | auto-dismissed flags (read-only) | any | | `{items: DismissedFlag[], total}` |
| GET `/cases/{id}` | full case | any | | `CaseDetail` |
| GET `/cases/{id}/timeline` | append-only history | any | | `TimelineEvent[]` (oldest first) |
| GET `/cases/{id}/eligible-reviewers?purpose=case\|appeal` | everyone with a verdict | any | | `EligibleReviewer[]` |
| POST `/cases/{id}/reviewers` | assign reviewer | administrator | `{reviewer_id, role_in_case: "primary"\|"secondary"}` | `CaseDetail` |
| POST `/cases/{id}/evidence` | add evidence | assigned reviewer, support staff (`learner_statement` only) | `{kind, description}` | `CaseDetail` |
| POST `/cases/{id}/reopen` | decided to under_review | assigned reviewer, administrator | `{reason}` | `CaseDetail` |
| POST `/cases/{id}/decision` | record decision | assigned reviewer | `{outcome, rationale, cited_evidence_ids: string[]}` | `CaseDetail` |
| POST `/cases/{id}/appeal` | file appeal for the learner | support staff, administrator | `{grounds}` | `CaseDetail` |
| POST `/cases/{id}/appeal/reviewer` | assign independent appeal reviewer | administrator | `{reviewer_id}` | `CaseDetail` |
| POST `/cases/{id}/appeal/outcome` | decide the appeal | the appeal reviewer | `{outcome, rationale}` | `CaseDetail` |
| POST `/cases/{id}/close` | close the case | administrator | `{}` | `CaseDetail` |
| GET `/audit/findings?case_id=` | auditor run live on the database; optional filter to one case | any | | `{counts: {issue_type: n}, findings: Finding[]}` |
| GET `/audit/metrics`, `/audit/validation` | evaluation and validation summary files | any | | provisional, see below |

## Shapes (TypeScript notation)
```ts
type Reviewer = { reviewer_id: string; name: string; role: Role; department: string };
type Rule = { rule_id: string; version: number; log_threshold: number; review_threshold: number; priority_threshold: number;
              appeal_window_days: number; effective_from: string; effective_to: string | null };
type QueueRow = { case_id: string; learner_id: string; learner_name: string; assessment_title: string; adjusted_score: number;
                  band: Band; status: Status; assignee_ids: string[]; opened_at: string;
                  needs_my_action: boolean };      // true when the requesting actor has at least one allowed action on the case
type QueueCounts = { needs_me: number;          // cases where the requesting actor has an allowed action
                     under_review: number;      // status open or under_review
                     awaiting_appeal: number;   // status appealed or appeal_review
                     decided: number;           // status decided or appeal_decided
                     closed: number; dismissed_flags: number };   // counted over ALL cases, ignoring the filters
type DismissedFlag = { similarity_report_id: string; submission_id: string; learner_id: string; raw_score: number;
                       quoted_score: number; template_score: number; adjusted_score: number; dismissal_reason: DismissalReason };
type CaseDetail = {
  case_id: string; status: Status; opened_at: string; closed_at: string | null;
  learner: { learner_id: string; name: string; department: string };
  assessment: { assessment_id: string; title: string; instructor_id: string };
  flag: { similarity_report_id: string; rule: Rule; raw_score: number; quoted_score: number; template_score: number;
          adjusted_score: number; band: Band;
          explanation: ExplainStep[] };            // how this report became a flag and then a case, in order
  reviewers: { reviewer_id: string; name: string; role_in_case: "primary" | "secondary"; assigned_at: string }[];
  evidence: { evidence_id: string; kind: EvidenceKind; description: string; added_at: string; added_by: string | null }[];
  decisions: { decision_id: string; outcome: DecisionOutcome; rationale: string; reviewer_id: string | null;
               decided_at: string; cited_evidence_ids: string[] }[];
  appeal: null | { appeal_id: string; grounds: string; filed_at: string; reviewer_id: string | null;
                   outcome: AppealOutcome | null; outcome_rationale: string | null; decided_at: string | null };
  effective_outcome: DecisionOutcome | null;      // latest decision, adjusted by a decided appeal
  allowed_actions: AllowedAction[];               // for the requesting actor, right now (actions whose check is allowed)
  action_checks: ActionCheck[];                   // every action with its verdict and plain-language reasons
};
type TimelineEvent = { event_id: number; event_type: EventType; occurred_at: string; actor_id: string | null; actor_name: string | null;
                       from_status: Status | null; to_status: Status | null; ref_id: string | null; reason: string | null }; // actor null = system
type EligibleReviewer = Reviewer & { eligible: boolean; reasons: { code: ConflictCode; message: string }[] };
type Finding = { issue_type: IssueType; case_id: string; entity_id: string; detail: string };
type ExplainStep = { step: "raw_score" | "exclusions" | "adjusted_score" | "band" | "outcome";
                     text: string;                       // plain language, e.g. "Raw score 0.71 is at or above the review gate 0.60, so this is a flag."
                     value: number | string | null; threshold: number | null };
type ActionCheck = { action: AllowedAction; allowed: boolean;
                     reasons: { code: string; message: string }[] };   // reasons empty when allowed; codes reuse the error codes
```
`action_checks` (and `allowed_actions`, its allowed subset) is the only source of what the UI may offer. A disallowed action is shown disabled with the
server's reason (for example `APPEAL_WINDOW_OPEN`: "Appeal window open until 25 Nov 2026"). The UI never re-implements a rule; it shows the server's `message`.

**Fairness gates.** Four gates per case, shown from `GET /audit/findings?case_id=`: a gate is `fail` when a finding of its issue type exists, `ok` when the
case has reached the stage it checks and none exists, `n/a` before that stage (no decision yet for gates 1 and 3, no appeal for gate 4).
| Gate (UI label) | Issue type | Stage it applies from |
|---|---|---|
| Human reviewed | `AUTO_GUILT_WITHOUT_REVIEW` | a decision exists |
| No conflict of interest | `REVIEWER_CONFLICT` | a reviewer is assigned |
| Evidence on record | `EVIDENCE_AFTER_DECISION_NO_HISTORY` | a decision exists |
| Independent appeal | `APPEAL_CLOSED_NO_INDEPENDENT_REVIEW` | an appeal exists |
**Audit file shapes (final, adopted from the frontend's types):** `dataset_hash` is the manifest hash of the loaded dataset.
```ts
type AuditMetrics = { dataset_hash: string;
  auditor: { issue_type: IssueType; precision: number; recall: number; f1: number; labelled: number }[];
  triage: { scenario: string; cases: number; flagged: number; dismissed: number }[] };   // triage versus the hidden scenario
type ValidationSummary = { dataset_hash: string; counts: Record<string, number>;
  checks: { name: string; passed: boolean; violations: number }[];
  distributions: { title: string; rows: { label: string; count: number }[] }[] };
```
The validator's `summarize(con)` returns `counts`, `checks` and `distributions`; the backend adds `dataset_hash` and serves the file.

## Example: error
```json
{"error": {"code": "CONFLICT_OF_INTEREST",
           "message": "REV-000004 teaches this assessment, so cannot review this case.",
           "details": {"reviewer_id": "REV-000004", "reasons": ["INSTRUCTOR_OF_ASSESSMENT"]}}}
```
