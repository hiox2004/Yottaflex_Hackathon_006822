// Steps are derived from the case status alone, so a reopen moves the rail back. Earlier steps jump to their record,
// later steps explain what comes first, and the current step carries the control for the next action (StageControl).
import * as Tooltip from '@radix-ui/react-tooltip';
import { Check } from 'lucide-react';
import { useState } from 'react';
import type { AllowedAction, CaseDetail, DecisionOutcome, Status } from '../api/types';
import { Badge, type Tone } from './ui/badge';
import { Card } from './ui/card';
import { StageControl } from './StageControl';

type StepKey = 'open' | 'under_review' | 'decided' | 'appeal' | 'closed';
export type StepState = 'done' | 'current' | 'todo';

const LABEL: Record<StepKey, string> = {
  open: 'Open',
  under_review: 'Under review',
  decided: 'Decided',
  appeal: 'Appeal',
  closed: 'Closed',
};

/** Who owns the next move at each step, shown under the step name. */
const OWNER: Record<StepKey, string> = {
  open: 'Administrator',
  under_review: 'Assigned reviewer',
  decided: 'Administrator or support staff',
  appeal: 'Independent appeal reviewer',
  closed: 'Administrator',
};

/** Where a finished step's record lives on the page (anchor ids set in CasePage). */
const RECORD_ANCHOR: Record<StepKey, string> = {
  open: 'timeline',
  under_review: 'evidence',
  decided: 'decisions',
  appeal: 'appeal',
  closed: 'timeline',
};

const STATUS_STEP: Record<Status, StepKey> = {
  open: 'open',
  under_review: 'under_review',
  decided: 'decided',
  appealed: 'appeal',
  appeal_review: 'appeal',
  appeal_decided: 'closed',
  closed: 'closed',
};

const APPEAL_STATUSES: Status[] = ['appealed', 'appeal_review', 'appeal_decided'];

/** The Appeal step appears only when an appeal exists or the status is an appeal status. */
export function journeySteps(detail: Pick<CaseDetail, 'status' | 'appeal'>): { key: StepKey; label: string; state: StepState }[] {
  const keys: StepKey[] = ['open', 'under_review', 'decided'];
  if (detail.appeal !== null || APPEAL_STATUSES.includes(detail.status)) keys.push('appeal');
  keys.push('closed');
  const current = keys.indexOf(STATUS_STEP[detail.status]);
  return keys.map((key, i) => ({
    key,
    label: LABEL[key],
    // Once the case is closed every step is done, so no step is left as "current".
    state: detail.status === 'closed' || i < current ? 'done' : i === current ? 'current' : 'todo',
  }));
}

/** Compact result chip on the Decided step, from the outcome that applies now. */
const DECISION_CHIP: Record<DecisionOutcome, { label: string; tone: Tone }> = {
  no_violation: { label: 'Cleared', tone: 'success' },
  violation_confirmed: { label: 'Failed', tone: 'danger' },
  inconclusive: { label: 'Inconclusive', tone: 'warning' },
};

/** A timestamp as a short day, e.g. "2 Nov 2026" (UTC, so the day matches the server record). */
const formatDay = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

interface Props {
  detail: CaseDetail;
  onAction: (action: AllowedAction) => void;
}

export function JourneyRail({ detail, onAction }: Props) {
  const steps = journeySteps(detail);
  const [tip, setTip] = useState<StepKey | null>(null);

  const scrollToRecord = (key: StepKey) => {
    document.getElementById(RECORD_ANCHOR[key])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Tooltip.Provider delayDuration={150}>
      <Card role="region" aria-label="Case progress" className="flex flex-col gap-4 p-5">
        <ol className="flex flex-wrap items-start gap-x-2 gap-y-4">
          {steps.map((step, i) => {
            const dot =
              step.state === 'done'
                ? 'border-primary bg-primary text-primary-foreground'
                : step.state === 'current'
                  ? 'border-primary bg-card text-primary ring-3 ring-primary/20'
                  : 'border-border bg-card text-muted-foreground';
            const previous = i > 0 ? steps[i - 1] : undefined;
            const decision = step.key === 'decided' && detail.effective_outcome ? DECISION_CHIP[detail.effective_outcome] : undefined;
            const closedChip =
              step.key === 'closed' && step.state === 'done' && detail.status === 'closed'
                ? detail.closed_at
                  ? `Closed ${formatDay(detail.closed_at)}`
                  : 'Closed'
                : undefined;

            const button = (
              <button
                type="button"
                aria-current={step.state === 'current' ? 'step' : undefined}
                onClick={(e) => {
                  if (step.state === 'done') scrollToRecord(step.key);
                  // Keep the tooltip open after this click: Radix would otherwise close it on the same click.
                  if (step.state === 'todo') {
                    e.preventDefault();
                    setTip(step.key);
                  }
                }}
                className={`flex flex-col items-start gap-1 rounded-md p-1 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary ${step.state === 'current' ? 'font-semibold' : ''}`}
              >
                <span className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="h-px w-4 bg-border" />}
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${dot}`}>
                    {step.state === 'done' && <Check size={12} aria-hidden />}
                  </span>
                  <span>{step.label}</span>
                </span>
                <span className={`pl-7 text-xs font-normal ${step.state === 'current' ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {OWNER[step.key]}
                </span>
              </button>
            );

            return (
              <li key={step.key} className="flex flex-col gap-1">
                {step.state === 'todo' && previous ? (
                  <Tooltip.Root open={tip === step.key} onOpenChange={(open) => setTip(open ? step.key : null)}>
                    <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        sideOffset={6}
                        className="z-50 max-w-xs rounded-md border bg-card px-3 py-2 text-xs text-foreground shadow-md"
                      >
                        {`Happens after ${previous.label}, done by ${OWNER[step.key]}`}
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                ) : (
                  button
                )}
                {decision && (
                  <Badge tone={decision.tone} className="ml-7 w-fit text-xs">
                    {decision.label}
                  </Badge>
                )}
                {closedChip && (
                  <Badge tone="neutral" className="ml-7 w-fit text-xs">
                    {closedChip}
                  </Badge>
                )}
              </li>
            );
          })}
        </ol>
        <StageControl detail={detail} onAction={onAction} />
      </Card>
    </Tooltip.Provider>
  );
}
