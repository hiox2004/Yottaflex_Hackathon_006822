// Append-only history, oldest first. A null actor is the system.
import type { TimelineEvent } from '../api/types';
import { EVENT_LABEL, formatDateTime, STATUS_LABEL } from '../labels';

export function Timeline({ events }: { events: TimelineEvent[] | undefined }) {
  if (!events) return <p className="muted">Loading history…</p>;
  return (
    <section aria-label="Timeline">
      <h2>Timeline</h2>
      <p className="small muted">History is append-only: nothing here can be edited or removed.</p>
      <ol className="timeline">
        {events.map((e) => (
          <li key={e.event_id}>
            <div>
              <strong>{EVENT_LABEL[e.event_type]}</strong>
              {e.to_status && (
                <span className="muted small">
                  {' '}
                  · {e.from_status ? `${STATUS_LABEL[e.from_status]} → ` : ''}
                  {STATUS_LABEL[e.to_status]}
                </span>
              )}
            </div>
            <div className="small muted">
              {formatDateTime(e.occurred_at)} · {e.actor_name ?? 'system (triage)'}
              {e.ref_id && <span className="mono"> · {e.ref_id}</span>}
            </div>
            {e.reason && <div className="small">{e.reason}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}
