// Queue summary tiles that double as server-side filters. Counts come from GET /queue `counts` (all cases).
import type { QueueCounts } from '../api/types';
import type { QueueFilters } from '../api/hooks';

export type TileKey = 'needs' | 'under_review' | 'appeal' | 'decided' | 'closed' | 'all';

export const TILES: { key: TileKey; label: string; filter: QueueFilters }[] = [
  { key: 'needs', label: 'Needs you', filter: { needs_my_action: true } },
  { key: 'under_review', label: 'Under review', filter: { status: 'open,under_review' } },
  { key: 'appeal', label: 'Awaiting appeal', filter: { status: 'appealed,appeal_review' } },
  { key: 'decided', label: 'Decided', filter: { status: 'decided,appeal_decided' } },
  { key: 'closed', label: 'Closed', filter: { status: 'closed' } },
  { key: 'all', label: 'All cases', filter: {} },
];

function tileCount(key: TileKey, c: QueueCounts): number {
  switch (key) {
    case 'needs': return c.needs_me;
    case 'under_review': return c.under_review;
    case 'appeal': return c.awaiting_appeal;
    case 'decided': return c.decided;
    case 'closed': return c.closed;
    case 'all': return c.under_review + c.awaiting_appeal + c.decided + c.closed;
  }
}

interface Props {
  counts: QueueCounts | undefined;
  active: TileKey;
  onSelect: (key: TileKey) => void;
}

export function NeedsTiles({ counts, active, onSelect }: Props) {
  return (
    <div className="tiles" role="group" aria-label="Filter cases">
      {TILES.map((tile) => (
        <button
          key={tile.key}
          type="button"
          className={tile.key === 'needs' ? 'tile tile-needs' : 'tile'}
          aria-pressed={active === tile.key}
          onClick={() => onSelect(tile.key)}
        >
          <span className="tile-count">{counts ? tileCount(tile.key, counts) : '–'}</span>
          <span className="tile-label">{tile.label}</span>
        </button>
      ))}
    </div>
  );
}
