// The case record: evidence, decisions (with the evidence they cite) and the appeal.
import type { CaseDetail } from '../api/types';
import { APPEAL_OUTCOME_LABEL, EVIDENCE_LABEL, formatDate, OUTCOME_LABEL } from '../labels';

export function EvidenceList({ detail }: { detail: CaseDetail }) {
  return (
    <section aria-label="Evidence">
      <h2>Evidence</h2>
      {detail.evidence.length === 0 && <p className="empty">No evidence yet. The assigned reviewer adds it before deciding.</p>}
      <ul className="records">
        {detail.evidence.map((e) => (
          <li key={e.evidence_id}>
            <span className="badge tone-neutral">{EVIDENCE_LABEL[e.kind]}</span>
            <span>{e.description}</span>
            <span className="small muted mono">
              {e.evidence_id} · {formatDate(e.added_at)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DecisionList({ detail }: { detail: CaseDetail }) {
  return (
    <section aria-label="Decision">
      <h2>Decision</h2>
      {detail.decisions.length === 0 && <p className="empty">No decision yet. A flag is not a finding until a reviewer decides.</p>}
      <ul className="records">
        {detail.decisions.map((d) => (
          <li key={d.decision_id}>
            <strong>{OUTCOME_LABEL[d.outcome]}</strong>
            <span>{d.rationale}</span>
            <span className="small muted mono">
              Cites {d.cited_evidence_ids.join(', ') || 'no evidence'} · {formatDate(d.decided_at)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AppealPanel({ detail }: { detail: CaseDetail }) {
  const { appeal } = detail;
  if (!appeal) return null;
  return (
    <section aria-label="Appeal">
      <h2>Appeal</h2>
      <ul className="records">
        <li>
          <strong>Grounds (filed {formatDate(appeal.filed_at)})</strong>
          <span>{appeal.grounds}</span>
          <span className="small muted">
            {appeal.reviewer_id ? `Independent reviewer: ${appeal.reviewer_id}` : 'Waiting for an administrator to assign an independent reviewer.'}
          </span>
        </li>
        {appeal.outcome && (
          <li>
            <strong>{APPEAL_OUTCOME_LABEL[appeal.outcome]}</strong>
            <span>{appeal.outcome_rationale}</span>
          </li>
        )}
      </ul>
    </section>
  );
}
