// Shows the server's plain-language message; takes focus when it appears so keyboard and screen-reader users notice it.
import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ApiError } from '../api/errors';

export function ErrorBanner({ error }: { error: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), [error]);
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const reasons = error instanceof ApiError ? error.details.reasons : undefined;
  return (
    <div className="banner tone-fail" role="alert" tabIndex={-1} ref={ref}>
      <TriangleAlert size={18} aria-hidden />
      <div>
        <strong>{message}</strong>
        {Array.isArray(reasons) && <div className="muted">Reason: {reasons.join(', ')}</div>}
      </div>
    </div>
  );
}
