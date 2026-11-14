// Everyone with a verdict: eligible reviewers first; conflicted or ineligible staff are shown disabled with the reason.
import type { EligibleReviewer } from '../api/types';
import { REASON_LABEL, ROLE_LABEL } from '../labels';
import { ErrorBanner } from './ErrorBanner';

interface Props {
  people: EligibleReviewer[] | undefined;
  /** Error from the eligibility query; shown in place of the loading text. */
  error?: unknown;
  selected?: string;
  onSelect?: (reviewerId: string) => void;
}

export function ReviewerPicker({ people, error, selected, onSelect }: Props) {
  if (!people) {
    return error ? (
      <ErrorBanner error={error} />
    ) : (
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Loading reviewers…
      </p>
    );
  }
  const ordered = [...people].sort((a, b) => Number(b.eligible) - Number(a.eligible));
  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((p) => (
        <li key={p.reviewer_id} className={`flex flex-col gap-1 rounded-md border p-3 text-sm ${p.eligible ? '' : 'opacity-60'}`}>
          <label className={`flex items-start gap-2 ${p.eligible ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            {onSelect && (
              <input
                type="radio"
                name="reviewer"
                value={p.reviewer_id}
                checked={selected === p.reviewer_id}
                disabled={!p.eligible}
                onChange={() => onSelect(p.reviewer_id)}
                className="mt-1 size-4 accent-primary"
              />
            )}
            <span>
              <strong className="font-semibold">{p.name}</strong>{' '}
              <span className="text-xs text-muted-foreground">
                {ROLE_LABEL[p.role]} · {p.department}
              </span>
            </span>
          </label>
          {p.reasons.map((r) => (
            <span key={r.code} className="text-xs text-muted-foreground">
              Not available: {REASON_LABEL[r.code] ?? r.message}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
