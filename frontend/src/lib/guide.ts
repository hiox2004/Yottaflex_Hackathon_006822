// Copy for the "How review works" guide. Plain words for non-technical staff.
// Every rule here mirrors the backend (lifecycle.py, conflicts.py, triage.py). Edit wording freely, but keep the facts true.

export interface GuideCard {
  title: string;
  points: string[];
}

export interface GuideStep {
  title: string;
  body: string;
  /** Who acts at this step, shown as role chips. */
  actors: string[];
}

export interface GuideRow {
  action: string;
  /** Short condition shown under the action name. */
  note: string;
  /** Allowed for, in WHO_COLUMNS order: Administrator, Support staff, Assigned reviewer or instructor, Appeal reviewer, Learner. */
  allowed: [boolean, boolean, boolean, boolean, boolean];
}

export interface GlossaryItem {
  term: string;
  meaning: string;
}

export const GUIDE_INTRO =
  'This page explains how a similarity flag becomes a fair, human decision. Use it as a reference any time you are unsure who does what.';

export const BIG_IDEA: GuideCard = {
  title: 'The big idea',
  points: [
    'A similarity score is never a verdict. It only asks a person to take a look.',
    'Quoted text and shared templates are taken off the score before any case is opened, so they are never counted against the learner.',
    'A person makes every decision, with a written reason and the evidence behind it.',
  ],
};

export const STEPS: GuideStep[] = [
  {
    title: 'Flag raised',
    body: 'A raw score of 0.60 or more raises a flag. Quoted and template text is then taken off, which gives the adjusted score. Adjusted 0.85 or more is priority review (0.80 under the earlier rule version). Adjusted 0.60 to 0.85 opens a case for review. Anything lower is dismissed automatically. Raw scores from 0.30 to 0.60 are logged only.',
    actors: ['Automatic'],
  },
  {
    title: 'Case opened',
    body: 'The case gathers the report, the evidence and the timeline in one place. The system never decides on its own.',
    actors: ['Automatic'],
  },
  {
    title: 'Reviewers assigned',
    body: 'An administrator assigns reviewers who have no conflict of interest. The system blocks anyone who teaches the assessment, is in the learner\'s department, has reviewed this learner before, or is already on the case.',
    actors: ['Administrator'],
  },
  {
    title: 'Reviewer steps aside',
    body: 'A reviewer who has a conflict of interest, or cannot review the case fairly, steps aside with a written reason. The reason is recorded in the case history. The case stays under review until an administrator assigns someone else.',
    actors: ['Assigned reviewer or instructor', 'Administrator'],
  },
  {
    title: 'Evidence added',
    body: 'Reviewers add evidence such as matched passages, source references and quote citations. Support staff add the learner\'s own statement. Once a decision is recorded, new evidence needs a reopen first.',
    actors: ['Support staff', 'Assigned reviewer'],
  },
  {
    title: 'Reviewer decides',
    body: 'The assigned reviewer chooses Clear, Fail or Inconclusive. They write a rationale and cite at least one piece of evidence. A Fail needs a rationale of at least 20 characters and a cited matched passage or source reference. Clear and Inconclusive go straight on to closing.',
    actors: ['Assigned reviewer'],
  },
  {
    title: 'If Fail: the learner may appeal',
    body: 'The learner can appeal a Fail. Support staff or an administrator files it, and only inside the appeal window (14 days under the current rule). An administrator closes a Fail after that window ends or once the appeal is decided. Closing sooner needs a recorded waiver, and an appeal in progress blocks closing.',
    actors: ['Learner', 'Support staff or Administrator'],
  },
  {
    title: 'Independent appeal reviewer assigned',
    body: 'An administrator picks a reviewer with no conflict of interest who did not decide this case and is not on it. If that reviewer becomes unavailable, an administrator can reassign the appeal to someone else while it is in review.',
    actors: ['Administrator'],
  },
  {
    title: 'Appeal decided',
    body: 'The appeal reviewer chooses upheld, overturned or partially upheld, with a written rationale.',
    actors: ['Appeal reviewer'],
  },
  {
    title: 'Case closed',
    body: 'The administrator closes the case. Its timeline stays exactly as it was.',
    actors: ['Administrator'],
  },
];

export const WHO_COLUMNS = ['Administrator', 'Support staff', 'Assigned reviewer or instructor', 'Appeal reviewer', 'Learner'] as const;

export const WHO_NOTE =
  'The appeal reviewer must be independent: not already on the case. The named appeal reviewer decides the appeal and has no other case actions. Every action is also checked against the case status. Learners see only their own cases.';

export const WHO_ROWS: GuideRow[] = [
  { action: 'Assign a reviewer', note: 'While the case is open or under review. Conflicts are blocked.', allowed: [true, false, false, false, false] },
  { action: 'Add evidence', note: 'Learners add their own statement while the case is open or under review. Support adds learner statements. Assigned reviewers add other evidence. After a decision, reopen first.', allowed: [false, true, true, false, true] },
  { action: 'Reopen the case', note: 'Decided cases only. Assigned reviewers only.', allowed: [true, false, true, false, false] },
  { action: 'Record a decision', note: 'Assigned reviewers only, while under review. A Fail needs a 20-character rationale and a cited matched passage or source reference.', allowed: [false, false, true, false, false] },
  { action: 'Step aside (recuse)', note: 'Assigned reviewers or instructors only, while under review. A written reason is required and recorded.', allowed: [false, false, true, false, false] },
  { action: 'File an appeal', note: 'Only after a Fail, once per case, inside the appeal window. Learners appeal their own case.', allowed: [true, true, false, false, true] },
  { action: 'Assign or reassign the appeal reviewer', note: 'Must be independent of the case. Reassigning is only possible while the appeal is in review.', allowed: [true, false, false, false, false] },
  { action: 'Decide the appeal', note: 'Only the named appeal reviewer, for that appeal.', allowed: [false, false, false, true, false] },
  { action: 'Close the case', note: 'Not while an appeal is open. Cleared and inconclusive decisions close at once. A Fail waits for the appeal window, unless the administrator closes early with a recorded waiver.', allowed: [true, false, false, false, false] },
];

export const FAIRNESS_RULES: string[] = [
  'No automatic guilt: a flag never becomes a finding by itself. A person decides.',
  'Conflict-of-interest blocks: reviewers who teach the assessment, share the learner\'s department, have reviewed this learner before, or are already on the case cannot be assigned.',
  'Independent appeal reviewer: whoever decided the case, or sits on it, cannot review its appeal.',
  'Appeal reviewer can be reassigned: if the appointed reviewer is unavailable, an administrator can replace them while the appeal is in review. The new reviewer must be someone else, and the change stays in the timeline.',
  'Appeal window: an appeal can be filed only before the window closes (14 days under the current rule). A Fail cannot be closed until the window ends or the appeal is decided, unless an administrator closes early with a recorded waiver. Cleared and inconclusive cases can be closed at once.',
  'Rationale required: every decision and appeal outcome needs a written reason. Confirming a violation needs a rationale of at least 20 characters and at least one incriminating item (a matched passage or source reference).',
  'Evidence after a decision needs a reopen, so the history shows that the case was reopened.',
  'Nothing is overwritten: the case timeline is append-only. Each action adds an entry.',
  'Reviewers step aside when conflicted; conflicts are re-checked when a decision is recorded.',
  'Every refusal explains why, in plain words, so nobody has to guess.',
];

export const TRY_IT = {
  title: 'Try it',
  body: 'Open the cases that need your decision. Then switch to another person with the Quick switch at the bottom of the sidebar and see what changes.',
  linkLabel: 'Open cases that need you',
  linkTo: '/cases?tab=needs',
};

export const GLOSSARY: GlossaryItem[] = [
  { term: 'Flag', meaning: 'A similarity report with a raw score of 0.60 or more. A flag asks for a look. It is not a finding.' },
  { term: 'Band', meaning: 'The level a score falls into: no action, logged only, review, or priority review.' },
  { term: 'Adjusted score', meaning: 'The raw score minus quoted and shared-template text. Cases are judged on this score.' },
  { term: 'Quoted or template exclusion', meaning: 'Cited quotes and shared template text taken off the score. They are never counted against the learner.' },
  { term: 'Case', meaning: 'The record for one flag: evidence, decisions, appeal and timeline, all in one place.' },
  { term: 'Appeal', meaning: 'The learner\'s challenge to a Fail. A separate reviewer decides it.' },
  { term: 'Independent reviewer', meaning: 'Someone with no conflict of interest who has not decided or joined this case.' },
  { term: 'Clear, Fail, Inconclusive', meaning: 'The three decisions a reviewer can record. Fail means a violation is confirmed.' },
  { term: 'Audit finding', meaning: 'A problem the automatic checker spots on the Audit page, such as a decision made without a human reviewer.' },
];
