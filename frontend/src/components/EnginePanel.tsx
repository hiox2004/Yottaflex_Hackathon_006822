// "How this flag became a case": the server's explanation steps plus the rule version. Shown only when the engine switch is on.
import type { CaseDetail } from '../api/types';

export function EnginePanel({ detail }: { detail: CaseDetail }) {
  const { rule, explanation } = detail.flag;
  return (
    <section className="engine" aria-label="How this flag became a case">
      <h2>How this flag became a case</h2>
      <p className="small mono muted">
        {rule.rule_id} v{rule.version} · log {rule.log_threshold.toFixed(2)} · review {rule.review_threshold.toFixed(2)} · priority{' '}
        {rule.priority_threshold.toFixed(2)} · appeal window {rule.appeal_window_days} days
      </p>
      <ol>
        {explanation.map((s) => (
          <li key={s.step}>
            <span className="engine-step mono">{s.step}</span>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
