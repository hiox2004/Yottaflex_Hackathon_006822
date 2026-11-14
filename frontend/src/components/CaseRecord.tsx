// The case record: evidence, decisions (with the evidence they cite) and the appeal.
import type { ReactNode } from 'react';
import type { CaseDetail } from '../api/types';
import { APPEAL_OUTCOME_LABEL, EVIDENCE_LABEL, formatDate, OUTCOME_LABEL } from '../labels';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

/** A titled card around a record list; `label` names the region for assistive tech. */
function RecordCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card role="region" aria-label={label} className="p-5">
      <h2 className="mb-3 text-base font-semibold tracking-tight">{label}</h2>
      {children}
    </Card>
  );
}

const LIST = 'flex flex-col divide-y';
const ITEM = 'flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0';
const META = 'font-mono text-xs text-muted-foreground';
const EMPTY = 'text-sm text-muted-foreground';

export function EvidenceList({ detail }: { detail: CaseDetail }) {
  return (
    <RecordCard label="Evidence">
      {detail.evidence.length === 0 && <p className={EMPTY}>No evidence yet. The assigned reviewer adds it before deciding.</p>}
      <ul className={LIST}>
        {detail.evidence.map((e) => (
          <li key={e.evidence_id} className={ITEM}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{EVIDENCE_LABEL[e.kind]}</Badge>
            </div>
            <span>{e.description}</span>
            <span className={META}>
              {e.evidence_id} · {formatDate(e.added_at)}
            </span>
          </li>
        ))}
      </ul>
    </RecordCard>
  );
}

export function DecisionList({ detail }: { detail: CaseDetail }) {
  return (
    <RecordCard label="Decision">
      {detail.decisions.length === 0 && <p className={EMPTY}>No decision yet. A flag is not a finding until a reviewer decides.</p>}
      <ul className={LIST}>
        {detail.decisions.map((d) => (
          <li key={d.decision_id} className={ITEM}>
            <strong className="font-semibold">{OUTCOME_LABEL[d.outcome]}</strong>
            <span>{d.rationale}</span>
            <span className={META}>
              Cites {d.cited_evidence_ids.join(', ') || 'no evidence'} · {formatDate(d.decided_at)}
            </span>
          </li>
        ))}
      </ul>
    </RecordCard>
  );
}

export function AppealPanel({ detail }: { detail: CaseDetail }) {
  const { appeal } = detail;
  if (!appeal) return null;
  return (
    <RecordCard label="Appeal">
      <ul className={LIST}>
        <li className={ITEM}>
          <strong className="font-semibold">Grounds (filed {formatDate(appeal.filed_at)})</strong>
          <span>{appeal.grounds}</span>
          <span className="text-xs text-muted-foreground">
            {appeal.reviewer_id ? `Independent reviewer: ${appeal.reviewer_id}` : 'Waiting for an administrator to assign an independent reviewer.'}
          </span>
        </li>
        {appeal.outcome && (
          <li className={ITEM}>
            <strong className="font-semibold">{APPEAL_OUTCOME_LABEL[appeal.outcome]}</strong>
            <span>{appeal.outcome_rationale}</span>
          </li>
        )}
      </ul>
    </RecordCard>
  );
}
