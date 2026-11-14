// One stacked bar on a 0-1 scale: unexplained | quoted | template, with the rule's log, review and priority threshold ticks.
import type { Rule } from '../api/types';
import { formatScore } from '../labels';

interface Props {
  unexplained: number;
  quoted?: number;
  template?: number;
  rule?: Rule | null;
  compact?: boolean;
}

const pct = (value: number) => `${Math.min(Math.max(value, 0), 1) * 100}%`;

export function SimilarityStrip({ unexplained, quoted = 0, template = 0, rule, compact = false }: Props) {
  const ticks = rule
    ? [
        { label: 'log', at: rule.log_threshold },
        { label: 'review', at: rule.review_threshold },
        { label: 'priority', at: rule.priority_threshold },
      ]
    : [];
  const summary =
    `Unexplained ${formatScore(unexplained)}` +
    (quoted || template ? `, quoted ${formatScore(quoted)}, template ${formatScore(template)}` : '');
  return (
    <div className={compact ? 'w-24 shrink-0' : 'w-full'}>
      <div role="img" aria-label={summary} className={`relative flex overflow-hidden rounded-full bg-muted ${compact ? 'h-1.5' : 'h-2.5'}`}>
        <span className="h-full bg-primary" style={{ width: pct(unexplained) }} />
        <span className="h-full bg-success/60" style={{ width: pct(quoted) }} />
        <span className="h-full bg-muted-foreground/40" style={{ width: pct(template) }} />
        {ticks.map((t) => (
          <span key={t.label} className="absolute inset-y-0 w-px bg-foreground/70" style={{ left: pct(t.at) }} />
        ))}
      </div>
      {!compact && ticks.length > 0 && (
        <div className="relative mt-1 h-4 text-xs text-muted-foreground" aria-hidden>
          {ticks.map((t) => (
            <span key={t.label} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(t.at) }}>
              {t.label} {t.at.toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
