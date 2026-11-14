// Display text keyed by server enum values. Wording protects learners: a flag is not a finding.
import type {
  AllowedAction,
  AppealOutcome,
  Band,
  DecisionOutcome,
  DismissalReason,
  EventType,
  EvidenceKind,
  Role,
  Status,
} from './api/types';

export const ACTION_LABEL: Record<AllowedAction, string> = {
  assign_reviewer: 'Assign a reviewer',
  add_evidence: 'Add evidence',
  reopen: 'Reopen the case',
  decide: 'Record a decision',
  file_appeal: 'File an appeal',
  assign_appeal_reviewer: 'Assign appeal reviewer',
  decide_appeal: 'Decide the appeal',
  close: 'Close the case',
};

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  matched_passage: 'Matched passage',
  source_reference: 'Source reference',
  template_match: 'Template match',
  quote_citation: 'Quote with citation',
  learner_statement: 'Learner statement',
};

/** Outcomes are worded so a flag never reads as a verdict. */
export const OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  no_violation: 'No violation found',
  violation_confirmed: 'Violation confirmed by reviewer',
  inconclusive: 'Inconclusive',
};

export const APPEAL_OUTCOME_LABEL: Record<AppealOutcome, string> = {
  upheld: 'Original decision upheld',
  overturned: 'Original decision overturned',
  partially_upheld: 'Partially upheld',
};

export const EVENT_LABEL: Record<EventType, string> = {
  case_opened: 'Case opened',
  reviewer_assigned: 'Reviewer assigned',
  evidence_added: 'Evidence added',
  decision_recorded: 'Decision recorded',
  case_reopened: 'Case reopened',
  appeal_filed: 'Appeal filed',
  appeal_reviewer_assigned: 'Appeal reviewer assigned',
  appeal_decided: 'Appeal decided',
  case_closed: 'Case closed',
};

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDateTime = (iso: string): string => dateTimeFormat.format(new Date(iso));

export const STATUS_LABEL: Record<Status, string> = {
  open: 'Open',
  under_review: 'Under review',
  decided: 'Decided',
  appealed: 'Appeal filed',
  appeal_review: 'Appeal in review',
  appeal_decided: 'Appeal decided',
  closed: 'Closed',
};

export const BAND_LABEL: Record<Band, string> = {
  no_action: 'No action',
  log_only: 'Logged only',
  review: 'Flagged for review',
  priority_review: 'Priority review',
};

export const ROLE_LABEL: Record<Role, string> = {
  instructor: 'Instructor',
  academic_reviewer: 'Academic reviewer',
  academic_administrator: 'Administrator',
  support_staff: 'Support staff',
};

export const DISMISSAL_LABEL: Record<DismissalReason, string> = {
  quote_only: 'Mostly properly quoted text',
  template_match: 'Mostly shared assignment template',
};

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDate = (iso: string): string => dateFormat.format(new Date(iso));

/** Scores are 0-1 with three decimals, shown as the server sends them. */
export const formatScore = (score: number): string => score.toFixed(3);

/** Who is waiting, per status: copy only, the server still decides what is allowed. */
export const NEXT_STEP: Record<Status, string> = {
  open: 'An administrator assigns a reviewer',
  under_review: 'The assigned reviewer records a decision',
  decided: 'Open for appeal; an administrator can close it once the window ends',
  appealed: 'An administrator assigns an independent appeal reviewer',
  appeal_review: 'The appeal reviewer decides the appeal',
  appeal_decided: 'An administrator can close this case',
  closed: 'Nothing further: the record is complete',
};
