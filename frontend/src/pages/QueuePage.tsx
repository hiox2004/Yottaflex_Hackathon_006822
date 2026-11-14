// Queue: opens on "Needs you"; tiles, band and "assigned to me" filter the loaded rows; second tab lists dismissed flags.
import { useMemo, useState } from 'react';
import { useQueue, useReviewers, useRules } from '../api/hooks';
import type { Band } from '../api/types';
import { CaseRow } from '../components/CaseRow';
import { DismissedList } from '../components/DismissedList';
import { ErrorBanner } from '../components/ErrorBanner';
import { NeedsTiles, TILES, type TileKey } from '../components/NeedsTiles';
import { BAND_LABEL } from '../labels';
import { useSession } from '../session';

const PAGE = 200;
type Tab = 'cases' | 'dismissed';

export function QueuePage() {
  const { actorId } = useSession();
  const [tab, setTab] = useState<Tab>('cases');
  const [tile, setTile] = useState<TileKey>('needs');
  const [band, setBand] = useState<Band | ''>('');
  const [mineOnly, setMineOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const queue = useQueue(actorId, limit);
  const reviewers = useReviewers(actorId);
  const rules = useRules(actorId);
  const names = useMemo(() => new Map((reviewers.data ?? []).map((r) => [r.reviewer_id, r.name])), [reviewers.data]);
  const activeRule = rules.data?.find((r) => r.effective_to === null) ?? null;

  const rows = queue.data?.items ?? [];
  const match = TILES.find((t) => t.key === tile)?.match ?? (() => true);
  const shown = rows.filter((r) => match(r) && (!band || r.band === band) && (!mineOnly || r.assignee_ids.includes(actorId)));

  return (
    <>
      <div className="page-head">
        <h1>Case queue</h1>
        <p className="lede">A flag is not a finding. Every case here needs a human decision before anything is recorded against a learner.</p>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'cases'} onClick={() => setTab('cases')}>
          Cases
        </button>
        <button role="tab" aria-selected={tab === 'dismissed'} onClick={() => setTab('dismissed')}>
          Dismissed flags
        </button>
      </div>
      {tab === 'dismissed' ? (
        <DismissedList />
      ) : (
        <section aria-label="Cases">
          {queue.error && <ErrorBanner error={queue.error} />}
          <NeedsTiles rows={rows} active={tile} onSelect={setTile} />
          <div className="filters">
            <label>
              Band{' '}
              <select value={band} onChange={(e) => setBand(e.target.value as Band | '')}>
                <option value="">All bands</option>
                {(['priority_review', 'review'] as Band[]).map((b) => (
                  <option key={b} value={b}>
                    {BAND_LABEL[b]}
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Assigned to me
            </label>
          </div>
          {queue.isPending && <p className="muted">Loading cases…</p>}
          {queue.data && shown.length === 0 && (
            <p className="empty">
              {tile === 'needs'
                ? 'Nothing is waiting on you right now. Pick "All cases" to browse, or switch actor to see another role’s work.'
                : 'No cases match these filters. Clear the band filter or pick another tile.'}
            </p>
          )}
          <ul className="list">
            {shown.map((row) => (
              <CaseRow key={row.case_id} row={row} rule={activeRule} names={names} />
            ))}
          </ul>
          {queue.data && rows.length < queue.data.total && (
            <button type="button" className="btn" onClick={() => setLimit(limit + PAGE)}>
              Load more ({rows.length} of {queue.data.total})
            </button>
          )}
        </section>
      )}
    </>
  );
}
