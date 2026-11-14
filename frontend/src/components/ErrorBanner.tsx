// Friendly red alert with the server's message; known reason codes get plain text. Takes focus when it appears so keyboard and screen-reader users notice it.
import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ApiError } from '../api/errors';
import { REASON_LABEL } from '../labels';

/** Shared wording lives in labels.ts; these are the codes it does not cover yet. */
const LOCAL_REASON: Record<string, string> = {
  NOT_ASSIGNED: 'Only the assigned reviewer can do this.',
  NOT_APPEAL_REVIEWER: 'Only the assigned appeal reviewer can do this.',
  APPEAL_UNRESOLVED: 'The appeal is still open, so this cannot happen yet.',
};

export function ErrorBanner({ error }: { error: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), [error]);
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const reasons = error instanceof ApiError ? error.details.reasons : undefined;
  return (
    <div
      role="alert"
      tabIndex={-1}
      ref={ref}
      className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-danger"
    >
      <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-danger" />
      <div className="flex flex-col gap-1">
        <strong className="font-semibold">{message}</strong>
        {Array.isArray(reasons) &&
          reasons.map((code) => (
            <span key={String(code)} className="text-muted-foreground">
              {REASON_LABEL[String(code)] ?? LOCAL_REASON[String(code)] ?? 'The server refused this step.'}{' '}
              <span className="font-mono text-xs">({String(code)})</span>
            </span>
          ))}
      </div>
    </div>
  );
}
