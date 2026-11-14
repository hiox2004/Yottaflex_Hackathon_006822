// Flagged > Assigned > Decided > Appeal > Closed: done steps filled, the current one ringed, later ones hollow.
import { Check } from 'lucide-react';
import type { CaseDetail } from '../api/types';

export function JourneyRail({ detail }: { detail: CaseDetail }) {
  const steps = [
    { label: 'Flagged', done: true, skipped: false },
    { label: 'Assigned', done: detail.reviewers.length > 0, skipped: false },
    { label: 'Decided', done: detail.decisions.length > 0, skipped: false },
    { label: detail.appeal ? 'Appeal' : 'No appeal', done: detail.appeal?.outcome != null, skipped: detail.appeal === null },
    { label: 'Closed', done: detail.closed_at !== null, skipped: false },
  ];
  const current = steps.findIndex((s) => !s.done && !s.skipped);
  return (
    <ol className="rail" aria-label="Case progress">
      {steps.map((step, i) => (
        <li key={step.label} className={step.done ? 'done' : i === current ? 'current' : step.skipped ? 'skipped' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="rail-dot">{step.done && <Check size={12} aria-hidden />}</span>
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
