// Action list: allowed actions sit under "Do now" with one primary button; blocked ones are collapsed under
// "Not available" with the server's plain reason. Nothing is hidden.
import type { ActionCheck, AllowedAction, Status } from '../api/types';
import { actionLabel, CLOSE_EARLY_LABEL } from '../labels';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface Props {
  checks: ActionCheck[];
  onAction: (action: AllowedAction) => void;
  /** Case status, so the same action can read differently (assign appeal reviewer -> reassign in appeal review). */
  status?: Status;
}

/** Most relevant first. The first allowed action in this order gets the primary style. */
const RELEVANCE: AllowedAction[] = [
  'decide',
  'recuse',
  'decide_appeal',
  'assign_reviewer',
  'assign_appeal_reviewer',
  'file_appeal',
  'close',
  'add_evidence',
  'reopen',
];

export function ActionList({ checks, onAction, status }: Props) {
  const allowed = checks.filter((c) => c.allowed).sort((a, b) => RELEVANCE.indexOf(a.action) - RELEVANCE.indexOf(b.action));
  const blocked = checks.filter((c) => !c.allowed);
  // Stepping aside is always a secondary (outline) choice, never the primary button.
  const primary = RELEVANCE.find((a) => a !== 'recuse' && allowed.some((c) => c.action === a));
  const reopenAvailable = allowed.some((c) => c.action === 'reopen');
  const waivable = waivableClose(checks);

  return (
    <Card role="region" aria-label="Actions" className="p-5">
      <h2 className="mb-3 text-base font-semibold tracking-tight">Actions</h2>

      <h3 className="mb-2 text-sm font-medium text-muted-foreground">Do now</h3>
      {allowed.length === 0 && !waivable && <p className="text-sm text-muted-foreground">Nothing to do right now.</p>}
      {allowed.length > 0 && (
        <ul className="flex flex-col gap-2">
          {allowed.map((check) => (
            <li key={check.action}>
              <Button
                type="button"
                variant={check.action === primary ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => onAction(check.action)}
              >
                {actionLabel(check.action, status)}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {waivable && (
        <div className="mt-2">
          <WaiveCloseButton onClick={() => onAction('close')} />
        </div>
      )}

      {blocked.length > 0 && (
        <details className="mt-4 rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">Not available ({blocked.length})</summary>
          <ul className="mt-3 flex flex-col gap-3">
            {blocked.map((check) => (
              <li key={check.action} className="flex flex-col gap-1">
                <span className="text-sm font-medium">{actionLabel(check.action, status)}</span>
                {check.reasons.map((r) => (
                  <span key={r.code} className="text-xs text-muted-foreground">
                    {r.message}
                  </span>
                ))}
                {reopenAvailable && check.reasons.some((r) => r.code === 'REOPEN_REQUIRED') && (
                  <Button type="button" variant="ghost" size="sm" className="self-start text-primary" onClick={() => onAction('reopen')}>
                    Reopen the case first
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

/** True when the close check is refused only because the appeal window is open, and an administrator may waive it. */
export const waivableClose = (checks: ActionCheck[]): boolean =>
  checks.some((c) => c.action === 'close' && !c.allowed && c.waivable === true);

/** The outlined, red-tinted choice to close before the appeal window ends. It opens the waiver form (CloseForm). */
export function WaiveCloseButton({ onClick, size }: { onClick: () => void; size?: 'sm' }) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={size === 'sm' ? 'border-danger/40 text-danger' : 'w-full justify-start border-danger/40 text-danger'}
      onClick={onClick}
    >
      {CLOSE_EARLY_LABEL}
    </Button>
  );
}
