// Four due-process gates from the auditor's findings for this case: ok / fail / n-a / unknown (mapping in the API contract).
import { Check, CircleSlash, TriangleAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CaseDetail, Finding, IssueType } from '../api/types';
import { Badge, type Tone } from './ui/badge';
import { Card } from './ui/card';
import { Hint } from './Hint';

const GATES: { label: string; issue: IssueType; applies: (c: CaseDetail) => boolean; protects: string; note: string }[] = [
  {
    label: 'Human reviewed',
    issue: 'AUTO_GUILT_WITHOUT_REVIEW',
    applies: (c) => c.decisions.length > 0,
    protects: 'No automatic guilt: a person must confirm any violation.',
    note: 'A person decided; software never confirms a violation.',
  },
  {
    label: 'No conflict of interest',
    issue: 'REVIEWER_CONFLICT',
    applies: (c) => c.reviewers.length > 0,
    protects: 'Fair judgement: the reviewer must not teach this assessment or share the learner’s department.',
    note: 'No reviewer teaches this assessment or shares the learner’s department.',
  },
  {
    label: 'Evidence on record',
    issue: 'EVIDENCE_AFTER_DECISION_NO_HISTORY',
    applies: (c) => c.decisions.length > 0,
    protects: 'A fixed record: evidence cannot quietly change after a decision.',
    note: 'No evidence changed after the decision without a reopen.',
  },
  {
    label: 'Independent appeal',
    issue: 'APPEAL_CLOSED_NO_INDEPENDENT_REVIEW',
    applies: (c) => c.appeal?.reviewer_id != null,
    protects: 'A fresh look: the appeal is decided by someone who did not decide the original case.',
    note: 'The appeal reviewer did not decide the original case.',
  },
];

const STATE_VIEW = {
  ok: { icon: Check, tone: 'success', word: 'Passed', colour: 'text-success' },
  fail: { icon: X, tone: 'danger', word: 'Failed', colour: 'text-danger' },
  na: { icon: CircleSlash, tone: 'neutral', word: 'Not yet applicable', colour: 'text-muted-foreground' },
  unknown: { icon: TriangleAlert, tone: 'warning', word: 'Could not check', colour: 'text-warning' },
} satisfies Record<string, { icon: typeof Check; tone: Tone; word: string; colour: string }>;

export function FairnessGates({ detail, findings, error }: { detail: CaseDetail; findings: Finding[] | undefined; error?: unknown }) {
  return (
    <Card role="region" aria-label="Fairness gates" className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight">
        Fairness gates
        <Hint text="Checks run by the auditor on this case. Each one protects the learner from an unfair outcome. Passed means the check found no problem." />
      </h2>
      <ul className="flex flex-col gap-3">
        {GATES.map((gate) => {
          const hit = findings?.find((f) => f.issue_type === gate.issue);
          const state = error ? 'unknown' : !findings ? 'na' : hit ? 'fail' : gate.applies(detail) ? 'ok' : 'na';
          const view = STATE_VIEW[state];
          const Icon = view.icon;
          return (
            <li key={gate.issue} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <Icon size={16} aria-hidden className={view.colour} /> {gate.label}
                  {gate.label === 'Independent appeal' && (
                    <Hint text="An independent reviewer is someone who did not take part in the original decision." />
                  )}
                </span>
                <Badge tone={view.tone}>{view.word}</Badge>
              </div>
              <span className="text-xs text-foreground/80">{gate.protects}</span>
              <span className="text-muted-foreground">
                {state === 'unknown' ? 'The audit findings could not be loaded, so this gate is not verified.' : hit ? hit.detail : gate.note}
                {hit && state === 'fail' && (
                  <>
                    {' '}
                    <Link to="/audit" className="text-primary underline underline-offset-2">
                      See in Audit
                    </Link>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
