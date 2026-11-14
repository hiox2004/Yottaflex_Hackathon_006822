// Four due-process gates from the auditor's findings for this case: ok / fail / n-a (mapping in the API contract).
import { Check, CircleSlash, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CaseDetail, Finding, IssueType } from '../api/types';

const GATES: { label: string; issue: IssueType; applies: (c: CaseDetail) => boolean; note: string }[] = [
  { label: 'Human reviewed', issue: 'AUTO_GUILT_WITHOUT_REVIEW', applies: (c) => c.decisions.length > 0, note: 'A person decided; software never confirms a violation.' },
  { label: 'No conflict of interest', issue: 'REVIEWER_CONFLICT', applies: (c) => c.reviewers.length > 0, note: 'No reviewer teaches this assessment or shares the learner’s department.' },
  { label: 'Evidence on record', issue: 'EVIDENCE_AFTER_DECISION_NO_HISTORY', applies: (c) => c.decisions.length > 0, note: 'No evidence changed after the decision without a reopen.' },
  { label: 'Independent appeal', issue: 'APPEAL_CLOSED_NO_INDEPENDENT_REVIEW', applies: (c) => c.appeal !== null, note: 'The appeal reviewer did not decide the original case.' },
];

export function FairnessGates({ detail, findings }: { detail: CaseDetail; findings: Finding[] | undefined }) {
  return (
    <section aria-label="Fairness gates">
      <h2>Fairness gates</h2>
      <ul className="gates">
        {GATES.map((gate) => {
          const hit = findings?.find((f) => f.issue_type === gate.issue);
          const state = !findings ? 'na' : hit ? 'fail' : gate.applies(detail) ? 'ok' : 'na';
          const Icon = state === 'ok' ? Check : state === 'fail' ? X : CircleSlash;
          const word = state === 'ok' ? 'Passed' : state === 'fail' ? 'Failed' : 'Not yet applicable';
          return (
            <li key={gate.issue} className={`gate gate-${state}`}>
              <span className="gate-head">
                <Icon size={16} aria-hidden /> <strong>{gate.label}</strong>
              </span>
              <span className="gate-word">{word}</span>
              <span className="small">
                {hit ? hit.detail : gate.note}
                {hit && (
                  <>
                    {' '}
                    <Link to="/audit">See in Audit</Link>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
