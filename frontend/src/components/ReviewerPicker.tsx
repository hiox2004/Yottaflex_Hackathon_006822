// Everyone with a verdict: conflicted or ineligible staff are shown disabled with the server's reason.
import type { EligibleReviewer } from '../api/types';
import { ROLE_LABEL } from '../labels';

interface Props {
  people: EligibleReviewer[] | undefined;
  selected?: string;
  onSelect?: (reviewerId: string) => void;
}

export function ReviewerPicker({ people, selected, onSelect }: Props) {
  if (!people) return <p className="muted">Loading reviewers…</p>;
  return (
    <ul className="picker">
      {people.map((p) => (
        <li key={p.reviewer_id} className={p.eligible ? '' : 'ineligible'}>
          <label>
            {onSelect && (
              <input
                type="radio"
                name="reviewer"
                value={p.reviewer_id}
                checked={selected === p.reviewer_id}
                disabled={!p.eligible}
                onChange={() => onSelect(p.reviewer_id)}
              />
            )}
            <span>
              <strong>{p.name}</strong> <span className="muted small">{ROLE_LABEL[p.role]} · {p.department}</span>
            </span>
          </label>
          {p.reasons.map((r) => (
            <span key={r.code} className="small why">
              Not available: {r.message}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
