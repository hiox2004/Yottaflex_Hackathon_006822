// Queue summary tiles that double as filters. "Needs you" comes from needs_my_action.
import type { QueueRow } from '../api/types';

export type TileKey = 'needs' | 'under_review' | 'appeal' | 'decided' | 'closed' | 'all';

export const TILES: { key: TileKey; label: string; match: (r: QueueRow) => boolean }[] = [
  { key: 'needs', label: 'Needs you', match: (r) => r.needs_my_action },
  { key: 'under_review', label: 'Under review', match: (r) => r.status === 'open' || r.status === 'under_review' },
  { key: 'appeal', label: 'Awaiting appeal', match: (r) => r.status === 'appealed' || r.status === 'appeal_review' },
  { key: 'decided', label: 'Decided', match: (r) => r.status === 'decided' || r.status === 'appeal_decided' },
  { key: 'closed', label: 'Closed', match: (r) => r.status === 'closed' },
  { key: 'all', label: 'All cases', match: () => true },
];

interface Props {
  rows: QueueRow[];
  active: TileKey;
  onSelect: (key: TileKey) => void;
}

export function NeedsTiles({ rows, active, onSelect }: Props) {
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
          <span className="tile-count">{rows.filter(tile.match).length}</span>
          <span className="tile-label">{tile.label}</span>
        </button>
      ))}
    </div>
  );
}
