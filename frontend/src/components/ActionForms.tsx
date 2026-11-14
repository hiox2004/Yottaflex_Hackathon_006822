// One small form per write action. Forms only check required fields; the server decides legality and its refusal is shown in the dialog.
import { useState, type FormEvent, type ReactNode } from 'react';
import type { AppealOutcome, CaseDetail, DecisionOutcome, EvidenceKind } from '../api/types';
import { useEligible } from '../api/hooks';
import { APPEAL_OUTCOME_LABEL, EVIDENCE_LABEL, OUTCOME_LABEL } from '../labels';
import { useSession } from '../session';
import { ReviewerPicker } from './ReviewerPicker';

export type Submit = (path: string, body: unknown) => void;
interface FormProps {
  detail: CaseDetail;
  onSubmit: Submit;
  busy: boolean;
}

interface FormShellProps {
  children: ReactNode;
  busy: boolean;
  submitLabel: string;
  /** Returns a message when a required field is missing, otherwise null. */
  check: () => string | null;
  send: () => void;
}

function FormShell({ children, busy, submitLabel, check, send }: FormShellProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const message = check();
    setProblem(message);
    if (!message) send();
  };
  return (
    <form onSubmit={submit} noValidate className="form">
      {children}
      {problem && (
        <p role="alert" className="form-error">
          {problem}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) => (
  <label className="field">
    {label}
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, text]) => (
        <option key={v} value={v}>
          {text}
        </option>
      ))}
    </select>
  </label>
);

const Text = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <label className="field">
    {label}
    <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
  </label>
);

function Reviewers({ purpose, detail, onSubmit, busy }: FormProps & { purpose: 'case' | 'appeal' }) {
  const { actorId } = useSession();
  const people = useEligible(actorId, detail.case_id, purpose);
  const [picked, setPicked] = useState('');
  const [role, setRole] = useState('primary');
  const forCase = purpose === 'case';
  return (
    <FormShell
      busy={busy}
      submitLabel="Assign"
      check={() => (picked ? null : 'Choose a reviewer first.')}
      send={() => onSubmit(forCase ? '/reviewers' : '/appeal/reviewer', forCase ? { reviewer_id: picked, role_in_case: role } : { reviewer_id: picked })}
    >
      <ReviewerPicker people={people.data} selected={picked} onSelect={setPicked} />
      {forCase && <Select label="Role on the case" value={role} onChange={setRole} options={[['primary', 'Primary'], ['secondary', 'Secondary']]} />}
    </FormShell>
  );
}

export const AssignReviewerForm = (p: FormProps) => <Reviewers purpose="case" {...p} />;
export const AssignAppealReviewerForm = (p: FormProps) => <Reviewers purpose="appeal" {...p} />;

export function EvidenceForm({ onSubmit, busy }: FormProps) {
  const [kind, setKind] = useState<EvidenceKind>('matched_passage');
  const [description, setDescription] = useState('');
  return (
    <FormShell
      busy={busy}
      submitLabel="Add evidence"
      check={() => (description.trim() ? null : 'Describe the evidence.')}
      send={() => onSubmit('/evidence', { kind, description: description.trim() })}
    >
      <Select label="Kind" value={kind} onChange={(v) => setKind(v as EvidenceKind)} options={Object.entries(EVIDENCE_LABEL)} />
      <Text label="Description" value={description} onChange={setDescription} />
    </FormShell>
  );
}

export function DecisionForm({ detail, onSubmit, busy }: FormProps) {
  const [outcome, setOutcome] = useState<DecisionOutcome>('no_violation');
  const [rationale, setRationale] = useState('');
  const [cited, setCited] = useState<string[]>([]);
  const toggle = (id: string) => setCited((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const check = () => {
    if (!rationale.trim()) return 'A decision needs a written rationale.';
    return cited.length === 0 ? 'Cite at least one piece of evidence.' : null;
  };
  return (
    <FormShell
      busy={busy}
      submitLabel="Record decision"
      check={check}
      send={() => onSubmit('/decision', { outcome, rationale: rationale.trim(), cited_evidence_ids: cited })}
    >
      <Select label="Outcome" value={outcome} onChange={(v) => setOutcome(v as DecisionOutcome)} options={Object.entries(OUTCOME_LABEL)} />
      <Text label="Rationale" value={rationale} onChange={setRationale} />
      <fieldset className="field">
        <legend>Evidence this decision relies on</legend>
        {detail.evidence.length === 0 && <p className="muted small">No evidence on record. Add evidence before deciding.</p>}
        {detail.evidence.map((e) => (
          <label key={e.evidence_id} className="check">
            <input type="checkbox" checked={cited.includes(e.evidence_id)} onChange={() => toggle(e.evidence_id)} />
            <span>
              {EVIDENCE_LABEL[e.kind]}: {e.description}
            </span>
          </label>
        ))}
      </fieldset>
    </FormShell>
  );
}

export function AppealOutcomeForm({ onSubmit, busy }: FormProps) {
  const [outcome, setOutcome] = useState<AppealOutcome>('upheld');
  const [rationale, setRationale] = useState('');
  return (
    <FormShell
      busy={busy}
      submitLabel="Record appeal outcome"
      check={() => (rationale.trim() ? null : 'The appeal outcome needs a written rationale.')}
      send={() => onSubmit('/appeal/outcome', { outcome, rationale: rationale.trim() })}
    >
      <Select label="Outcome" value={outcome} onChange={(v) => setOutcome(v as AppealOutcome)} options={Object.entries(APPEAL_OUTCOME_LABEL)} />
      <Text label="Rationale" value={rationale} onChange={setRationale} />
    </FormShell>
  );
}

interface TextFormProps {
  path: string;
  field: string;
  label: string;
  submitLabel: string;
  onSubmit: Submit;
  busy: boolean;
}

/** Reopen (reason) and file appeal (grounds) are one required text each. */
export function TextForm({ path, field, label, submitLabel, onSubmit, busy }: TextFormProps) {
  const [text, setText] = useState('');
  return (
    <FormShell
      busy={busy}
      submitLabel={submitLabel}
      check={() => (text.trim() ? null : `${label} is required.`)}
      send={() => onSubmit(path, { [field]: text.trim() })}
    >
      <Text label={label} value={text} onChange={setText} />
    </FormShell>
  );
}

export function CloseForm({ onSubmit, busy }: { onSubmit: Submit; busy: boolean }) {
  return (
    <FormShell busy={busy} submitLabel="Close the case" check={() => null} send={() => onSubmit('/close', {})}>
      <p>Closing records the case as complete. This cannot be undone.</p>
    </FormShell>
  );
}
