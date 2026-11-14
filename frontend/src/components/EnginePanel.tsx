// "How this flag became a case": rule version and thresholds, then the server's explanation steps as a vertical stepper. Open by default.
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { CaseDetail } from '../api/types';
import { Hint } from './Hint';
import { Card } from './ui/card';

export function EnginePanel({ detail }: { detail: CaseDetail }) {
  const [open, setOpen] = useState(true);
  const { rule, explanation } = detail.flag;
  return (
    <Card role="region" aria-label="How this flag became a case" className="p-5">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">How this flag became a case</h2>
          <Collapsible.Trigger className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
            {open ? 'Hide' : 'Show'}
            <ChevronDown size={16} aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </Collapsible.Trigger>
        </div>
        <Collapsible.Content>
          <p className="mt-3 text-sm text-muted-foreground">
            The system compares the submission with other work, removes innocent overlap such as quotes and shared templates, and records each
            step below. A high score only flags the case for a human to look at.
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 font-mono text-xs text-muted-foreground">
            {rule.rule_id} v{rule.version} · log {rule.log_threshold.toFixed(2)} · review {rule.review_threshold.toFixed(2)} · priority{' '}
            {rule.priority_threshold.toFixed(2)} · appeal window {rule.appeal_window_days} days
            <Hint text="The appeal window is how many days the learner has to appeal after a decision, counted from the decision date." />
          </p>
          <ol className="mt-4 flex flex-col">
            {explanation.map((s, i) => (
              <li key={s.step} className="relative flex gap-3 pb-4 last:pb-0">
                {i < explanation.length - 1 && <span aria-hidden className="absolute left-3 top-7 bottom-0 w-px bg-border" />}
                <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-xs">{i + 1}</span>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{s.step}</span>
                  <span>{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
}
