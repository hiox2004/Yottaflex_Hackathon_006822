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
  recuse: 'Step aside (recuse)',
  file_appeal: 'File an appeal',
  assign_appeal_reviewer: 'Assign appeal reviewer',
  decide_appeal: 'Decide the appeal',
  close: 'Close the case',
};

/** Same action key, different words in one status: an appeal reviewer can be reassigned while the appeal is in review. */
export const actionLabel = (action: AllowedAction, status?: Status): string =>
  action === 'assign_appeal_reviewer' && status === 'appeal_review' ? 'Reassign appeal reviewer' : ACTION_LABEL[action];

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
  reviewer_recused: 'Reviewer stepped aside',
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
  learner: 'Learner',
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
  decided: 'A cleared or inconclusive case can be closed now. A Fail is open for appeal; an administrator can close it once the window ends',
  appealed: 'An administrator assigns an independent appeal reviewer',
  appeal_review: 'The appeal reviewer decides the appeal. An administrator can reassign them if they are unavailable',
  appeal_decided: 'An administrator can close this case',
  closed: 'Nothing further: the record is complete',
};

/** Reason codes from the server, as plain sentences. Unknown codes fall back to the code itself. */
export const REASON_LABEL: Record<string, string> = {
  ROLE_NOT_ALLOWED: 'Your role may not do this action.',
  INVALID_TRANSITION: 'The case is not in a state that allows this action.',
  APPEAL_EXISTS: 'An appeal has already been filed for this case.',
  REOPEN_REQUIRED: 'The case is decided; reopen it first so the change is on the record.',
  NOT_ADVERSE: 'The case has no adverse outcome, so there is nothing to appeal.',
  ROLE_CANNOT_REVIEW: 'Administrators and support staff cannot review cases.',
  SAME_DEPARTMENT: "This reviewer works in the learner's department.",
  INSTRUCTOR_OF_ASSESSMENT: 'This reviewer teaches the assessment.',
  REVIEWED_LEARNER_BEFORE: 'This reviewer has reviewed this learner before.',
  ALREADY_ON_CASE: 'This reviewer is already assigned to the case.',
  DECIDED_THIS_CASE: 'This reviewer already decided this case.',
  APPEAL_WINDOW_CLOSED: 'The appeal window has closed, so no appeal can be filed now.',
  SAME_APPEAL_REVIEWER: 'That person already holds this appeal. Choose a different appeal reviewer.',
  RATIONALE_TOO_SHORT: 'A confirmed violation needs a rationale of at least 20 characters.',
  NO_INCRIMINATING_EVIDENCE: 'A confirmed violation must cite a matched passage or source reference.',
  APPEAL_WINDOW_OPEN: 'The learner can still appeal, so a confirmed violation cannot close until the appeal window ends. An administrator can close it early by waiving the window with a reason.',
  WAIVER_REASON_REQUIRED: 'Waiving the appeal window needs a reason, kept in the case history.',
  RECUSAL_REASON_REQUIRED: 'Give a reason for stepping aside. It is recorded in the case history.',
  NOT_ASSIGNED: 'Only the assigned reviewer can do this, and only while the case is under review.',
  CONFLICT_OF_INTEREST: 'You have a conflict of interest with this case. Step aside so an administrator can assign someone else.',
};

/** Shown when a case is under review with no active reviewer (everyone stepped aside). */
export const NO_REVIEWER_TEXT = 'This case has no active reviewer. An administrator needs to assign one.';

/** Audit scenarios from the synthetic generator: what each one means. */
export const SCENARIO_LABEL: Record<string, string> = {
  clean: 'Clean submissions',
  legitimate_quote: 'Properly quoted text',
  shared_template: 'Shared assignment template',
  false_positive: 'Innocent overlap (false positive)',
  genuine_copy: 'Genuine copying',
};

/** Turns a server key into display text: 'priority_review' -> 'Priority review', 'dismissed (quote_only)' -> 'Dismissed (quote only)'. */
export const humanise = (key: string): string => {
  const spaced = key.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** Button and dialog title for closing before the appeal window ends (administrator waiver). */
export const CLOSE_EARLY_LABEL = 'Close early (waive appeal)';

/** The appeal window end date as the server words it ("... until 25 Nov 2026. ..."), or null when the message has none. */
export const appealWindowEnd = (message: string | undefined): string | null => {
  const match = message?.match(/until (\d{1,2} [A-Za-z]{3} \d{4})/);
  return match?.[1] ?? null;
};
