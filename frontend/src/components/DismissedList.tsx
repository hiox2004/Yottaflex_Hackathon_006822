// Dismissed flags tab: read-only. Auto-dismissal only favours the learner, so no human confirmation is needed.
import { useState } from 'react';
import { useDismissedFlags } from '../api/hooks';
import { DISMISSAL_LABEL, formatScore } from '../labels';
import { useSession } from '../session';
import { ErrorBanner } from './ErrorBanner';
import { SimilarityStrip } from './SimilarityStrip';

const PAGE = 50;

export function DismissedList() {
  const { actorId } = useSession();
  const [limit, setLimit] = useState(PAGE);
  const flags = useDismissedFlags(actorId, limit);
  if (flags.error) return <ErrorBanner error={flags.error} />;
  if (!flags.data) return <p className="muted">Loading dismissed flags…</p>;
  const { items, total } = flags.data;
  return (
    <section aria-label="Dismissed flags">
      <p className="lede">
        These reports scored high on raw similarity, but once quoted text and the assignment template were excluded they fell below the
        review gate. Nobody is flagged; they are listed here so the decision stays visible.
      </p>
      {items.length === 0 && <p className="empty">No dismissed flags. Nothing to do here.</p>}
      <ul className="list">
        {items.map((f) => (
          <li key={f.similarity_report_id} className="case-row dismissed-row">
            <div className="case-score">
              <span className="mono score">{formatScore(f.raw_score)}</span>
              <SimilarityStrip unexplained={f.adjusted_score} quoted={f.quoted_score} template={f.template_score} compact />
            </div>
            <div className="case-main">
              <span className="case-title">{DISMISSAL_LABEL[f.dismissal_reason]}</span>
              <span className="mono muted small">
                {f.similarity_report_id} · {f.learner_id}
              </span>
            </div>
            <div className="case-next small mono">
              raw {formatScore(f.raw_score)} − quoted {formatScore(f.quoted_score)} − template {formatScore(f.template_score)} = adjusted{' '}
              {formatScore(f.adjusted_score)}
            </div>
          </li>
        ))}
      </ul>
      {items.length < total && (
        <button type="button" className="btn" onClick={() => setLimit(limit + PAGE)}>
          Load more ({items.length} of {total})
        </button>
      )}
    </section>
  );
}
