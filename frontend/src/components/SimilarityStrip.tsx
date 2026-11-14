// One bar on a 0-1 scale: unexplained | quoted | template, with the rule's three threshold ticks.
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
    <div className={compact ? 'strip strip-compact' : 'strip'}>
      <div className="strip-bar" role="img" aria-label={summary}>
        <span className="seg seg-unexplained" style={{ width: pct(unexplained) }} />
        <span className="seg seg-quoted" style={{ width: pct(quoted) }} />
        <span className="seg seg-template" style={{ width: pct(template) }} />
        {ticks.map((t) => (
          <span key={t.label} className="tick" style={{ left: pct(t.at) }} />
        ))}
      </div>
      {!compact && ticks.length > 0 && (
        <div className="strip-scale" aria-hidden>
          {ticks.map((t) => (
            <span key={t.label} style={{ left: pct(t.at) }}>
              {t.label} {t.at.toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
