// Rules: every rule version with its thresholds on the 0-1 scale, plus a worked example drawn with the SimilarityStrip.
import { useRules } from '../api/hooks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SimilarityStrip } from '../components/SimilarityStrip';
import { formatDate } from '../labels';
import { useSession } from '../session';

export function RulesPage() {
  const { actorId } = useSession();
  const rules = useRules(actorId);
  const current = rules.data?.find((r) => r.effective_to === null);
  return (
    <>
      <div className="page-head">
        <h1>Rules</h1>
        <p className="lede">
          Thresholds are versioned. A case keeps the rule version that was in force when it was flagged, so a later change never rewrites an
          earlier case.
        </p>
      </div>
      <ErrorBanner error={rules.error} />
      {rules.isPending && <p className="muted">Loading rules…</p>}
      {current && (
        <section className="card">
          <h2>Worked example</h2>
          <p className="muted">
            A report with raw similarity 0.71, of which 0.12 is quoted and 0.05 is the assignment template, leaves 0.54 unexplained. That is
            below the review gate ({current.review_threshold.toFixed(2)}), so it is dismissed without a case. Quoted and template text are never
            counted against the learner.
          </p>
          <SimilarityStrip unexplained={0.54} quoted={0.12} template={0.05} rule={current} />
        </section>
      )}
      <ul className="list">
        {rules.data?.map((r) => (
          <li key={`${r.rule_id}-${r.version}`} className="card rule">
            <h2>
              {r.rule_id} <span className="mono">v{r.version}</span>{' '}
              <span className={r.effective_to === null ? 'badge tone-ok' : 'badge tone-muted'}>{r.effective_to === null ? 'In force' : 'Superseded'}</span>
            </h2>
            <dl className="facts">
              <div><dt>Logged from</dt><dd className="mono">{r.log_threshold.toFixed(2)}</dd></div>
              <div><dt>Review from</dt><dd className="mono">{r.review_threshold.toFixed(2)}</dd></div>
              <div><dt>Priority from</dt><dd className="mono">{r.priority_threshold.toFixed(2)}</dd></div>
              <div><dt>Appeal window</dt><dd className="mono">{r.appeal_window_days} days</dd></div>
              <div><dt>Effective</dt><dd>{formatDate(r.effective_from)} to {r.effective_to ? formatDate(r.effective_to) : 'now'}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
