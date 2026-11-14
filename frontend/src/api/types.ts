// Hand-written mirror of docs/api-contract.md v1.1. Keep in step with the contract, never with the backend code.
export type Role = 'instructor' | 'academic_reviewer' | 'academic_administrator' | 'support_staff';
export type Band = 'no_action' | 'log_only' | 'review' | 'priority_review';
export type Status =
  | 'open'
  | 'under_review'
  | 'decided'
  | 'appealed'
  | 'appeal_review'
  | 'appeal_decided'
  | 'closed';
export type EvidenceKind =
  | 'matched_passage'
  | 'source_reference'
  | 'template_match'
  | 'quote_citation'
  | 'learner_statement';
export type DecisionOutcome = 'no_violation' | 'violation_confirmed' | 'inconclusive';
export type AppealOutcome = 'upheld' | 'overturned' | 'partially_upheld';
export type DismissalReason = 'quote_only' | 'template_match';
export type IssueType =
  | 'AUTO_GUILT_WITHOUT_REVIEW'
  | 'REVIEWER_CONFLICT'
  | 'EVIDENCE_AFTER_DECISION_NO_HISTORY'
  | 'APPEAL_CLOSED_NO_INDEPENDENT_REVIEW';
export type AllowedAction =
  | 'assign_reviewer'
  | 'add_evidence'
  | 'reopen'
  | 'decide'
  | 'file_appeal'
  | 'assign_appeal_reviewer'
  | 'decide_appeal'
  | 'close';
export type EventType =
  | 'case_opened'
  | 'reviewer_assigned'
  | 'evidence_added'
  | 'decision_recorded'
  | 'case_reopened'
  | 'appeal_filed'
  | 'appeal_reviewer_assigned'
  | 'appeal_decided'
  | 'case_closed';

export interface Reviewer {
  reviewer_id: string;
  name: string;
  role: Role;
  department: string;
}

export interface Rule {
  rule_id: string;
  version: number;
  log_threshold: number;
  review_threshold: number;
  priority_threshold: number;
  appeal_window_days: number;
  effective_from: string;
  effective_to: string | null;
}

export interface QueueRow {
  case_id: string;
  learner_id: string;
  learner_name: string;
  assessment_title: string;
  adjusted_score: number;
  band: Band;
  status: Status;
  assignee_ids: string[];
  opened_at: string;
  needs_my_action: boolean;
}

export interface DismissedFlag {
  similarity_report_id: string;
  submission_id: string;
  learner_id: string;
  raw_score: number;
  quoted_score: number;
  template_score: number;
  adjusted_score: number;
  dismissal_reason: DismissalReason;
}

export interface ExplainStep {
  step: 'raw_score' | 'exclusions' | 'adjusted_score' | 'band' | 'outcome';
  text: string;
  value: number | string | null;
  threshold: number | null;
}

export interface ActionCheck {
  action: AllowedAction;
  allowed: boolean;
  reasons: { code: string; message: string }[];
}

export interface CaseDetail {
  case_id: string;
  status: Status;
  opened_at: string;
  closed_at: string | null;
  learner: { learner_id: string; name: string; department: string };
  assessment: { assessment_id: string; title: string; instructor_id: string };
  flag: {
    similarity_report_id: string;
    rule: Rule;
    raw_score: number;
    quoted_score: number;
    template_score: number;
    adjusted_score: number;
    band: Band;
    explanation: ExplainStep[];
  };
  reviewers: { reviewer_id: string; name: string; role_in_case: 'primary' | 'secondary'; assigned_at: string }[];
  evidence: { evidence_id: string; kind: EvidenceKind; description: string; added_at: string; added_by: string | null }[];
  decisions: {
    decision_id: string;
    outcome: DecisionOutcome;
    rationale: string;
    reviewer_id: string | null;
    decided_at: string;
    cited_evidence_ids: string[];
  }[];
  appeal: null | {
    appeal_id: string;
    grounds: string;
    filed_at: string;
    reviewer_id: string | null;
    outcome: AppealOutcome | null;
    outcome_rationale: string | null;
    decided_at: string | null;
  };
  effective_outcome: DecisionOutcome | null;
  allowed_actions: AllowedAction[];
  action_checks: ActionCheck[];
}

export interface TimelineEvent {
  event_id: number;
  event_type: EventType;
  occurred_at: string;
  actor_id: string | null;
  actor_name: string | null;
  from_status: Status | null;
  to_status: Status | null;
  ref_id: string | null;
  reason: string | null;
}

export interface EligibleReviewer extends Reviewer {
  eligible: boolean;
  reasons: { code: string; message: string }[];
}

export interface Finding {
  issue_type: IssueType;
  case_id: string;
  entity_id: string;
  detail: string;
}

export interface FindingsResponse {
  counts: Partial<Record<IssueType, number>>;
  findings: Finding[];
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface QueueCounts {
  needs_me: number;
  under_review: number;
  awaiting_appeal: number;
  decided: number;
  closed: number;
  dismissed_flags: number;
}

export interface QueuePageData extends Page<QueueRow> {
  counts: QueueCounts;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}
