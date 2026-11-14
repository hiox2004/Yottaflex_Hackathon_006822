// Fixtures: a case detail for every queue row, built per status, plus timelines, eligible reviewers and findings.
import type {
  ActionCheck,
  AllowedAction,
  CaseDetail,
  EligibleReviewer,
  Finding,
  QueueRow,
  Status,
  TimelineEvent,
} from '../types';
import { queueRows } from './queue';
import { reviewers } from './reviewers';
import { rules } from './rules';

const ACTIONS: AllowedAction[] = [
  'assign_reviewer',
  'add_evidence',
  'reopen',
  'decide',
  'file_appeal',
  'assign_appeal_reviewer',
  'decide_appeal',
  'close',
];

const WHY: Record<AllowedAction, { code: string; message: string }> = {
  assign_reviewer: { code: 'INVALID_TRANSITION', message: 'A reviewer can only be assigned before a decision.' },
  add_evidence: { code: 'REOPEN_REQUIRED', message: 'This case is decided. Reopen it before adding evidence, so the change is on the record.' },
  reopen: { code: 'INVALID_TRANSITION', message: 'Only a decided case can be reopened.' },
  decide: { code: 'NOT_ASSIGNED', message: 'Only an assigned reviewer can record a decision, and only while the case is under review.' },
  file_appeal: { code: 'INVALID_TRANSITION', message: 'An appeal can be filed only after a decision, once.' },
  assign_appeal_reviewer: { code: 'INVALID_TRANSITION', message: 'There is no appeal waiting for a reviewer.' },
  decide_appeal: { code: 'NOT_APPEAL_REVIEWER', message: 'Only the independent appeal reviewer can decide this appeal.' },
  close: { code: 'APPEAL_WINDOW_OPEN', message: 'Appeal window open until 25 Nov 2026. A case cannot close before it ends.' },
};

const ALLOWED_BY_STATUS: Record<Status, AllowedAction[]> = {
  open: ['assign_reviewer'],
  under_review: ['add_evidence', 'decide'],
  decided: ['reopen', 'file_appeal'],
  appealed: ['assign_appeal_reviewer'],
  appeal_review: ['decide_appeal'],
  appeal_decided: ['close'],
  closed: [],
};

const checks = (status: Status): ActionCheck[] =>
  ACTIONS.map((action) => {
    const allowed = ALLOWED_BY_STATUS[status].includes(action);
    return { action, allowed, reasons: allowed ? [] : [WHY[action]] };
  });

function buildCase(row: QueueRow): CaseDetail {
  const rule = rules[0]!;
  const exclusions = row.adjusted_score > 0.85 ? 0.04 : 0.12;
  const quoted = Math.round(exclusions * 0.7 * 1000) / 1000;
  const template = Math.round((exclusions - quoted) * 1000) / 1000;
  const raw = Math.round((row.adjusted_score + exclusions) * 1000) / 1000;
  const primary = reviewers.find((r) => r.reviewer_id === row.assignee_ids[0]);
  const base = row.case_id.slice(4);
  const decided = row.status !== 'open' && row.status !== 'under_review';
  const appealed = ['appealed', 'appeal_review', 'appeal_decided'].includes(row.status);
  const overturned = row.status === 'appeal_decided';
  return {
    case_id: row.case_id,
    status: row.status,
    opened_at: row.opened_at,
    closed_at: row.status === 'closed' ? '2026-11-02T10:00:00Z' : null,
    learner: { learner_id: row.learner_id, name: row.learner_name, department: 'Computer Science' },
    assessment: { assessment_id: 'ASM-2026-000007', title: row.assessment_title, instructor_id: 'REV-000004' },
    flag: {
      similarity_report_id: `SIM-${base}`,
      rule,
      raw_score: raw,
      quoted_score: quoted,
      template_score: template,
      adjusted_score: row.adjusted_score,
      band: row.band,
      explanation: [
        { step: 'raw_score', text: `Raw score ${raw.toFixed(2)} is at or above the review gate ${rule.review_threshold.toFixed(2)}, so this is a flag.`, value: raw, threshold: rule.review_threshold },
        { step: 'exclusions', text: `Quoted text (${quoted.toFixed(3)}) and the assignment template (${template.toFixed(3)}) are set aside before judging.`, value: exclusions, threshold: null },
        { step: 'adjusted_score', text: `Adjusted score ${row.adjusted_score.toFixed(3)} is what is left unexplained.`, value: row.adjusted_score, threshold: null },
        { step: 'band', text: `Adjusted score is at or above the review gate, so the band is ${row.band.replace('_', ' ')}.`, value: row.band, threshold: rule.review_threshold },
        { step: 'outcome', text: 'A case is opened for a human reviewer. A flag is not a finding.', value: 'case_opened', threshold: null },
      ],
    },
    reviewers: primary && row.status !== 'open'
      ? [{ reviewer_id: primary.reviewer_id, name: primary.name, role_in_case: 'primary', assigned_at: '2026-11-11T09:00:00Z' }]
      : [],
    evidence: row.status === 'open' ? [] : [
      { evidence_id: `EVD-${base}-001`, kind: 'matched_passage', description: 'Paragraphs 3 to 5 match a published tutorial almost word for word.', added_at: '2026-11-11T10:00:00Z', added_by: primary?.reviewer_id ?? null },
      { evidence_id: `EVD-${base}-002`, kind: 'source_reference', description: 'Source: public lecture notes, week 4, no citation in the submission.', added_at: '2026-11-11T10:20:00Z', added_by: primary?.reviewer_id ?? null },
    ],
    decisions: decided ? [{
      decision_id: `DEC-${base}-001`,
      outcome: row.status === 'closed' && row.case_id.endsWith('011') ? 'no_violation' : 'violation_confirmed',
      rationale: 'The matched passages are substantial, uncited and not covered by the quotation or template exclusions.',
      reviewer_id: primary?.reviewer_id ?? null,
      decided_at: '2026-10-25T15:00:00Z',
      cited_evidence_ids: [`EVD-${base}-001`, `EVD-${base}-002`],
    }] : [],
    appeal: appealed ? {
      appeal_id: `APL-${base}`,
      grounds: 'The learner says the passages come from a group handout the class was told to use.',
      filed_at: '2026-10-28T09:00:00Z',
      reviewer_id: row.status === 'appealed' ? null : 'REV-000012',
      outcome: overturned ? 'overturned' : null,
      outcome_rationale: overturned ? 'The handout was issued to the class; the passages are explained.' : null,
      decided_at: overturned ? '2026-11-05T12:00:00Z' : null,
    } : null,
    effective_outcome: !decided ? null : overturned ? 'no_violation' : row.case_id.endsWith('011') ? 'no_violation' : 'violation_confirmed',
    allowed_actions: ALLOWED_BY_STATUS[row.status],
    action_checks: checks(row.status),
  };
}

export const caseDetails: CaseDetail[] = queueRows.map(buildCase);

export function timelineFor(detail: CaseDetail): TimelineEvent[] {
  let id = 0;
  const event = (e: Partial<TimelineEvent> & Pick<TimelineEvent, 'event_type' | 'occurred_at'>): TimelineEvent => ({
    event_id: ++id, actor_id: null, actor_name: null, from_status: null, to_status: null, ref_id: null, reason: null, ...e,
  });
  const staff = detail.reviewers[0];
  const out = [event({ event_type: 'case_opened', occurred_at: detail.opened_at, to_status: 'open', reason: 'Triage: adjusted score reached the review gate' })];
  if (staff) out.push(event({ event_type: 'reviewer_assigned', occurred_at: '2026-11-11T09:00:00Z', actor_id: 'REV-000021', actor_name: 'Helen Marsh', from_status: 'open', to_status: 'under_review', ref_id: staff.reviewer_id }));
  detail.evidence.forEach((e) => out.push(event({ event_type: 'evidence_added', occurred_at: e.added_at, actor_id: staff?.reviewer_id ?? null, actor_name: staff?.name ?? null, ref_id: e.evidence_id })));
  detail.decisions.forEach((d) => out.push(event({ event_type: 'decision_recorded', occurred_at: d.decided_at, actor_id: staff?.reviewer_id ?? null, actor_name: staff?.name ?? null, from_status: 'under_review', to_status: 'decided', ref_id: d.decision_id, reason: d.rationale })));
  if (detail.appeal) out.push(event({ event_type: 'appeal_filed', occurred_at: detail.appeal.filed_at, actor_id: 'REV-000031', actor_name: 'Tomás Vidal', from_status: 'decided', to_status: 'appealed', ref_id: detail.appeal.appeal_id, reason: detail.appeal.grounds }));
  if (detail.closed_at) out.push(event({ event_type: 'case_closed', occurred_at: detail.closed_at, actor_id: 'REV-000021', actor_name: 'Helen Marsh', to_status: 'closed' }));
  return out;
}

const REASONS: Record<string, { code: string; message: string }> = {
  'REV-000004': { code: 'INSTRUCTOR_OF_ASSESSMENT', message: 'Teaches this assessment, so cannot review this case.' },
  'REV-000011': { code: 'SAME_DEPARTMENT', message: 'Works in the learner’s department (Computer Science).' },
};

export function eligibleFor(purpose: string): EligibleReviewer[] {
  return reviewers.map((r) => {
    const reasons = [];
    if (r.role === 'academic_administrator' || r.role === 'support_staff') reasons.push({ code: 'ROLE_CANNOT_REVIEW', message: 'Administrators and support staff cannot review cases.' });
    else if (REASONS[r.reviewer_id]) reasons.push(REASONS[r.reviewer_id]!);
    if (purpose === 'appeal' && r.reviewer_id === 'REV-000013') reasons.push({ code: 'DECIDED_THIS_CASE', message: 'Decided this case, so cannot review its appeal.' });
    return { ...r, eligible: reasons.length === 0, reasons };
  });
}

export const findings: Finding[] = [
  { issue_type: 'EVIDENCE_AFTER_DECISION_NO_HISTORY', case_id: 'CAS-2026-000009', entity_id: 'EVD-CAS-2026-000009-003', detail: 'Evidence was added after the decision without the case being reopened.' },
  { issue_type: 'REVIEWER_CONFLICT', case_id: 'CAS-2026-000015', entity_id: 'REV-000011', detail: 'Reviewer works in the learner’s department.' },
  { issue_type: 'APPEAL_CLOSED_NO_INDEPENDENT_REVIEW', case_id: 'CAS-2026-000010', entity_id: 'APL-2026-000010', detail: 'Appeal was reviewed by the person who made the original decision.' },
];
