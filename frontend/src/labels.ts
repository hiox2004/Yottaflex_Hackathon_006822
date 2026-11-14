// Display text keyed by server enum values. Wording protects learners: a flag is not a finding.
import type { Band, DismissalReason, Role, Status } from './api/types';

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
