// Test Lab prompt for external AIs: the domain rules, the exact schema, scenario examples, and the Load example set.
import type { LabCase } from '../api/lab';

const CLEAN_REVIEWER = {
  reviewer_id: 'REV-000042',
  role: 'academic_reviewer',
  department: 'Chemistry',
  learner_department: 'Physics',
  assessment_instructor_id: 'INS-000003',
  reviewed_learner_before: false,
  on_case: false,
  decided_case: false,
} as const;

// One full example per scenario type. `expect` is what a CORRECT system must do.
export const EXAMPLE_CASES: LabCase[] = [
  {
    id: 'normal-low-similarity',
    title: 'Normal: low similarity, logged only',
    scores: { raw: 0.45, quoted: 0.05, template: 0.02 },
    expect: { is_flag: false, opens_case: false, band: 'log_only' },
  },
  {
    id: 'boundary-review-gate',
    title: 'Boundary: raw exactly at the review gate',
    scores: { raw: 0.6, quoted: 0, template: 0 },
    expect: { is_flag: true, opens_case: true, band: 'review' },
  },
  {
    id: 'boundary-just-below-gate',
    title: 'Boundary: raw 0.01 below the review gate',
    scores: { raw: 0.59, quoted: 0, template: 0 },
    expect: { is_flag: false, opens_case: false, band: 'log_only' },
  },
  {
    id: 'boundary-priority-gate',
    title: 'Priority review: adjusted exactly at 0.85',
    scores: { raw: 0.88, quoted: 0.02, template: 0.01 },
    expect: { is_flag: true, opens_case: true, band: 'priority_review' },
  },
  {
    id: 'legitimate-quote',
    title: 'Legitimate quote: adjusted 0.52, auto-dismissed',
    scores: { raw: 0.72, quoted: 0.2, template: 0 },
    expect: { is_flag: true, opens_case: false, band: 'log_only', dismissal_reason: 'quote_only' },
  },
  {
    id: 'shared-template',
    title: 'Shared assignment template: adjusted 0.53, auto-dismissed',
    scores: { raw: 0.75, quoted: 0.02, template: 0.2 },
    expect: { is_flag: true, opens_case: false, band: 'log_only', dismissal_reason: 'template_match' },
  },
  {
    id: 'false-positive-dismissed',
    title: 'False positive: adjusted 0.26, auto-dismissed',
    scores: { raw: 0.66, quoted: 0.3, template: 0.1 },
    expect: { is_flag: true, opens_case: false, band: 'no_action', dismissal_reason: 'quote_only' },
  },
  {
    id: 'genuine-copy-review',
    title: 'Genuine copy: adjusted 0.62, case opened for review',
    scores: { raw: 0.64, quoted: 0.02, template: 0 },
    expect: { is_flag: true, opens_case: true, band: 'review' },
  },
  {
    id: 'auto-guilt-blocked',
    title: 'Violation confirmed with no human reviewer',
    scores: { raw: 0.64, quoted: 0, template: 0 },
    decision: { outcome: 'violation_confirmed', reviewer_id: null, rationale: 'Similarity report alone.' },
    expect: { decision_blocked: true },
  },
  {
    id: 'reviewer-same-department',
    title: 'Reviewer from the learner department',
    scores: { raw: 0.64, quoted: 0, template: 0 },
    reviewer: { ...CLEAN_REVIEWER, department: 'Physics', learner_department: 'Physics' },
    expect: { reviewer_blocked: true },
  },
  {
    id: 'evidence-after-decision-no-reopen',
    title: 'Evidence after a decision, case not reopened',
    scores: { raw: 0.64, quoted: 0, template: 0 },
    decision: { outcome: 'no_violation', reviewer_id: 'REV-000042', rationale: 'Insufficient evidence.' },
    late_evidence: { case_reopened_first: false },
    expect: { decision_blocked: false, evidence_blocked: true },
  },
  {
    id: 'appeal-by-decider-blocked',
    title: 'Appeal reviewer already decided this case',
    scores: { raw: 0.64, quoted: 0, template: 0 },
    appeal_reviewer: { ...CLEAN_REVIEWER, reviewer_id: 'REV-000007', decided_case: true },
    expect: { appeal_reviewer_blocked: true },
  },
];

// The Load example button fills the editor with these (valid, all expectations pass).
const LOAD_IDS = [
  'normal-low-similarity',
  'boundary-review-gate',
  'boundary-priority-gate',
  'legitimate-quote',
  'shared-template',
  'auto-guilt-blocked',
  'reviewer-same-department',
  'evidence-after-decision-no-reopen',
  'appeal-by-decider-blocked',
];
export const LOAD_EXAMPLE_CASES: LabCase[] = EXAMPLE_CASES.filter((c) => LOAD_IDS.includes(c.id));

const examples = EXAMPLE_CASES.map((c) => `  ${JSON.stringify(c)}`).join(',\n');

export const LAB_PROMPT = `You are writing TEST CASES for an academic-integrity rule engine. A deterministic engine checks them. You decide nothing.

HOW THE RULES WORK
1. A similarity report has a raw score (0-1). Raw >= 0.60 (review gate) makes a FLAG. A flag only asks a human to review; it is never automatic guilt.
2. Quoted and shared-template text are excluded: adjusted = raw - quoted - template. A case opens only if adjusted >= 0.60. Otherwise the flag is auto-dismissed as quote_only or template_match (the larger exclusion; a tie is quote_only).
3. Bands use the adjusted score for flags and the raw score otherwise: no_action < 0.30 <= log_only < 0.60 <= review < 0.85 <= priority_review. Lower edges are inclusive.
4. A reviewer is blocked (reviewer_blocked) if their role is not instructor or academic_reviewer, they teach this assessment, they are in the learner's department, they reviewed another case of this learner, or they are already on this case.
5. An appeal reviewer must be independent: no conflict from rule 4 and they must not have decided this case (appeal_reviewer_blocked). A decision needs a non-empty rationale, and violation_confirmed needs a human reviewer_id (decision_blocked). Evidence added after a decision needs case_reopened_first = true (evidence_blocked).

TASK
Write about 20 cases that cover: normal low similarity; boundaries (raw exactly 0.60, 0.59, adjusted exactly 0.85 and 0.84, adjusted exactly 0.30 and 0.29); a legitimate quote; a shared template; a false positive that is auto-dismissed; a genuine copy that opens a case; priority review; and each negative scenario (violation confirmed without a human reviewer, reviewer conflicts of several kinds, evidence after a decision without reopening, appeal closed without an independent reviewer). Include at least one correct variant of each check that is NOT blocked. Give every case a unique id.

For each case, "expect" holds what a CORRECT system must do. Only include the keys you are sure of.

OUTPUT RULES
- Reply with ONLY one JSON object of the form {"cases":[ ... ]}.
- No prose, no markdown, no code fences, no comments.
- Numbers are JSON numbers between 0 and 1. Use at most 3 decimals.

SCHEMA (any key marked optional may be left out; no other keys allowed)
- id: string, 1-40 characters, unique
- title: string, up to 200 characters, plain words
- scores: {"raw": number, "quoted": number, "template": number}, all 0-1
- reviewer (optional): {"reviewer_id": string, "role": "instructor" | "academic_reviewer" | "academic_administrator" | "support_staff" (default "academic_reviewer"), "department": string, "learner_department": string, "assessment_instructor_id": string (default "INS-NONE"), "reviewed_learner_before": boolean (default false), "on_case": boolean (default false), "decided_case": boolean (default false)}
- appeal_reviewer (optional): same shape as reviewer
- decision (optional): {"outcome": "no_violation" | "violation_confirmed" | "inconclusive", "reviewer_id": string or null, "rationale": string}
- late_evidence (optional): {"case_reopened_first": boolean}
- expect (optional): any subset of {"is_flag": boolean, "opens_case": boolean, "band": "no_action" | "log_only" | "review" | "priority_review", "dismissal_reason": "quote_only" | "template_match" (only when auto-dismissed), "reviewer_blocked": boolean (only when the case has a reviewer), "appeal_reviewer_blocked": boolean (only with appeal_reviewer), "decision_blocked": boolean (only with decision), "evidence_blocked": boolean (only with late_evidence)}

EXAMPLES (one per scenario type, copy the shape)
{"cases":[
${examples}
]}`;
