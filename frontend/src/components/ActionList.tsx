// Every action_checks entry: allowed = button, not allowed = disabled with the server's reason underneath. Nothing is hidden.
import type { ActionCheck, AllowedAction } from '../api/types';
import { ACTION_LABEL } from '../labels';

interface Props {
  checks: ActionCheck[];
  onAction: (action: AllowedAction) => void;
}

export function ActionList({ checks, onAction }: Props) {
  return (
    <section aria-label="Actions">
      <h2>Actions</h2>
      <ul className="actions">
        {checks.map((check) => (
          <li key={check.action}>
            <button
              type="button"
              className={check.allowed ? 'btn btn-primary' : 'btn'}
              disabled={!check.allowed}
              onClick={() => onAction(check.action)}
            >
              {ACTION_LABEL[check.action]}
            </button>
            {!check.allowed &&
              check.reasons.map((r) => (
                <span key={r.code} className="small muted why">
                  {r.message}
                </span>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
