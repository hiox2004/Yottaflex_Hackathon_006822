// One small form per write action. Forms only check required fields; the server decides legality and its refusal is shown in the dialog.
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { AppealOutcome, CaseDetail, DecisionOutcome, EvidenceKind, Role } from '../api/types';
import { useEligible, useReviewers } from '../api/hooks';
import { appealWindowEnd, EVIDENCE_LABEL } from '../labels';
import { useSession } from '../session';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Select as NativeSelect, Textarea } from './ui/field';
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
  /** Says what is still missing, above the submit button. While set, submit stays disabled. */
  blocker?: string | null;
  /** Disables submit without a text hint. Used when a checklist (footer) says what is missing. */
  blocked?: boolean;
  /** Rendered directly above the submit button, e.g. a checklist. */
  footer?: ReactNode;
  /** Id of the element that explains the submit button (aria-describedby). */
  describedBy?: string;
  /** Called when the user activates the submit button while it is blocked, so the explanation can be shown. */
  onBlockedTap?: () => void;
}

function FormShell({ children, busy, submitLabel, check, send, blocker = null, blocked = false, footer, describedBy, onBlockedTap }: FormShellProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const isBlocked = blocked || blocker !== null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const message = check();
    setProblem(message);
    if (!message) send();
  };
  // Disabled controls may not fire click in every browser, so the wrapper also listens for pointer down.
  const tapWhileBlocked = () => {
    if (isBlocked) onBlockedTap?.();
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {children}
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      {blocker && <p className="text-sm text-muted-foreground">{blocker}</p>}
      {footer}
      <div className="flex flex-col" onClickCapture={tapWhileBlocked} onPointerDownCapture={tapWhileBlocked}>
        <Button type="submit" disabled={busy || isBlocked} aria-describedby={describedBy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

const LABEL = 'flex flex-col gap-1.5 text-sm font-medium';
const RATIONALE_MAX = 2000;
/** Client mirror of the backend rule: a confirmed violation needs this many characters of rationale. */
const CONFIRMED_RATIONALE_MIN = 20;
/** Client mirror of the backend rule: a confirmed violation must cite one of these. */
const INCRIMINATING: EvidenceKind[] = ['matched_passage', 'source_reference'];

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) => (
  <label className={LABEL}>
    {label}
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, text]) => (
        <option key={v} value={v}>
          {text}
        </option>
      ))}
    </NativeSelect>
  </label>
);

const Text = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <label className={LABEL}>
    {label}
    <Textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} className="py-2" />
  </label>
);

/** The required rationale, with a live counter. minLength (a confirmed violation) is stated in the counter and turns it red below the minimum. */
function RationaleField({ value, onChange, minLength }: { value: string; onChange: (v: string) => void; minLength?: number }) {
  const hintId = useId();
  const length = value.trim().length;
  const short = minLength !== undefined && length < minLength;
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL}>
        Rationale
        <Textarea
          rows={4}
          maxLength={RATIONALE_MAX}
          value={value}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value)}
          className="py-2"
        />
      </label>
      <p id={hintId} className="text-xs text-muted-foreground">
        Explain why, in plain words. This is shown to the learner and kept in the audit trail.{' '}
        <span className={cn(short && 'font-medium text-danger')}>
          {minLength === undefined ? `${length} characters` : `${length} characters (minimum ${minLength} to confirm a violation)`}
        </span>
      </p>
    </div>
  );
}

/** A large radio option. */
function ChoiceCard({
  name,
  value,
  checked,
  onSelect,
  title,
  body,
  tone = 'neutral',
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  body: string;
  tone?: 'danger' | 'neutral';
}) {
  const danger = tone === 'danger';
  return (
    <div
      className={cn(
        'rounded-lg border-2 transition-colors',
        checked ? (danger ? 'border-danger bg-danger/10' : 'border-primary bg-primary/5') : 'border-foreground/15 bg-card hover:bg-muted',
      )}
    >
      <label className="flex cursor-pointer items-start gap-3 p-4">
        <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="mt-1 size-5 accent-primary" />
        <span className="flex flex-col gap-1">
          <span className={cn('text-base font-semibold', checked && danger && 'text-danger')}>{title}</span>
          <span className="text-sm text-muted-foreground">{body}</span>
        </span>
      </label>
    </div>
  );
}

function Reviewers({ purpose, detail, onSubmit, busy }: FormProps & { purpose: 'case' | 'appeal' }) {
  const { actorId } = useSession();
  const people = useEligible(actorId, detail.case_id, purpose);
  const [picked, setPicked] = useState('');
  const [role, setRole] = useState('primary');
  const forCase = purpose === 'case';
  // In appeal review the admin may replace the current appeal reviewer: that person is not offered again.
  const reassigning = !forCase && detail.status === 'appeal_review';
  const current = detail.appeal?.reviewer_id ?? null;
  const offered = reassigning && current ? people.data?.filter((r) => r.reviewer_id !== current) : people.data;
  return (
    <FormShell
      busy={busy}
      submitLabel={reassigning ? 'Reassign' : 'Assign'}
      check={() => (picked ? null : 'Choose a reviewer first.')}
      send={() => onSubmit(forCase ? '/reviewers' : '/appeal/reviewer', forCase ? { reviewer_id: picked, role_in_case: role } : { reviewer_id: picked })}
    >
      {reassigning && (
        <p className="text-sm text-muted-foreground">
          Use this if the current appeal reviewer is unavailable. The earlier reviewer is replaced and the change is recorded in the timeline.
        </p>
      )}
      <ReviewerPicker people={offered} error={people.error} selected={picked} onSelect={setPicked} />
      {forCase && <Select label="Role on the case" value={role} onChange={setRole} options={[['primary', 'Primary'], ['secondary', 'Secondary']]} />}
    </FormShell>
  );
}

export const AssignReviewerForm = (p: FormProps) => <Reviewers purpose="case" {...p} />;
export const AssignAppealReviewerForm = (p: FormProps) => <Reviewers purpose="appeal" {...p} />;

/** Evidence kinds the acting role may record (rules/lifecycle.py guard_evidence_kind). Learners and support staff: the learner's statement only. Unknown role: the statement only, the safe default. */
function evidenceKindsFor(role: Role | undefined): EvidenceKind[] {
  if (role === undefined || role === 'learner' || role === 'support_staff') return ['learner_statement'];
  return Object.keys(EVIDENCE_LABEL) as EvidenceKind[];
}

export function EvidenceForm({ onSubmit, busy }: FormProps) {
  const { actorId } = useSession();
  const me = useReviewers(actorId).data?.find((r) => r.reviewer_id === actorId);
  const kinds = evidenceKindsFor(me?.role);
  const [chosen, setChosen] = useState<EvidenceKind>('matched_passage');
  const kind = kinds.includes(chosen) ? chosen : kinds[0]!;
  const [description, setDescription] = useState('');
  return (
    <FormShell
      busy={busy}
      submitLabel="Add evidence"
      check={() => (description.trim() ? null : 'Describe the evidence.')}
      send={() => onSubmit('/evidence', { kind, description: description.trim() })}
    >
      <Select label="Kind" value={kind} onChange={(v) => setChosen(v as EvidenceKind)} options={kinds.map((k): [string, string] => [k, EVIDENCE_LABEL[k]])} />
      <Text label="Description" value={description} onChange={setDescription} />
    </FormShell>
  );
}

/** One line of the 'Before you can confirm' checklist. The mark and the words both say whether it is done. */
function CheckItem({ met, note, children }: { met: boolean; note?: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className={cn('font-bold', met ? 'text-success' : 'text-danger')}>
        {met ? '✓' : '✕'}
      </span>
      <span className="sr-only">{met ? 'Done:' : 'To do:'}</span>
      <span className="flex flex-col gap-0.5">
        {children}
        {note && !met && <span className="text-xs text-muted-foreground">{note}</span>}
      </span>
    </li>
  );
}

/** Copy for each decision. Body shape sent to the server is unchanged: outcome, rationale, cited_evidence_ids. */
const DECISION_CHOICES: { value: DecisionOutcome; title: string; body: string | ((appealDays: number) => string); submit: string; tone: 'danger' | 'neutral' }[] = [
  {
    value: 'no_violation',
    title: 'Clear the learner',
    body: 'The overlap is explained. No action against the learner.',
    submit: 'Clear learner',
    tone: 'neutral',
  },
  {
    value: 'violation_confirmed',
    title: 'Fail: violation confirmed',
    body: (appealDays) => `A human reviewer finds a breach of integrity rules. The learner may appeal within ${appealDays} ${appealDays === 1 ? 'day' : 'days'} (the appeal window under the current rule).`,
    submit: 'Confirm violation',
    tone: 'danger',
  },
  {
    value: 'inconclusive',
    title: 'Inconclusive',
    body: 'Not enough evidence either way. Nothing is recorded against the learner.',
    submit: 'Record inconclusive',
    tone: 'neutral',
  },
];

export function DecisionForm({ detail, onSubmit, busy }: FormProps) {
  const [outcome, setOutcome] = useState<DecisionOutcome>('no_violation');
  const [rationale, setRationale] = useState('');
  const [cited, setCited] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const checklistId = useId();
  const checklistRef = useRef<HTMLElement>(null);
  const toggle = (id: string) => setCited((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const choice = DECISION_CHOICES.find((c) => c.value === outcome)!;
  const failing = outcome === 'violation_confirmed';
  const incriminating = detail.evidence.filter((e) => INCRIMINATING.includes(e.kind));
  const citedIncriminating = incriminating.some((e) => cited.includes(e.evidence_id));
  const rationaleLength = rationale.trim().length;

  const scrollToChecklist = useCallback(() => {
    const el = checklistRef.current;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  // Choosing Fail brings the checklist into view: it sits under the evidence list, out of sight in a long dialog.
  useEffect(() => {
    if (failing) scrollToChecklist();
  }, [failing, scrollToChecklist]);

  // Clear and Inconclusive: the first missing thing, in the order a reviewer fills the form.
  let blocker: string | null = null;
  if (!failing) {
    if (detail.evidence.length === 0) blocker = 'No evidence on record. Add evidence before deciding.';
    else if (cited.length === 0) blocker = 'Tick at least one piece of evidence to enable submit.';
    else if (!rationale.trim()) blocker = 'Write a rationale to enable submit.';
  }
  // Fail: all three checklist items must be met. The checklist, not a text hint, says what is missing.
  const failReady = rationaleLength >= CONFIRMED_RATIONALE_MIN && citedIncriminating && confirmed;

  const checklist = failing ? (
    <section
      ref={checklistRef}
      id={checklistId}
      aria-label="Before you can confirm"
      className="flex flex-col gap-2 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm"
    >
      <h3 className="font-semibold">Before you can confirm</h3>
      <ul className="flex flex-col gap-2">
        <CheckItem met={rationaleLength >= CONFIRMED_RATIONALE_MIN}>
          Written rationale of at least {CONFIRMED_RATIONALE_MIN} characters ({rationaleLength}/{CONFIRMED_RATIONALE_MIN})
        </CheckItem>
        <CheckItem
          met={citedIncriminating}
          note={incriminating.length === 0 ? 'None on record. Use Add evidence on this page first.' : undefined}
        >
          At least one matched passage or source reference cited
        </CheckItem>
        <CheckItem met={confirmed}>
          <label className="flex items-start gap-2 font-medium">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-danger" />
            You confirm you reviewed the cited evidence yourself
          </label>
        </CheckItem>
      </ul>
    </section>
  ) : null;

  return (
    <FormShell
      busy={busy}
      submitLabel={choice.submit}
      blocker={blocker}
      blocked={failing && !failReady}
      footer={checklist}
      describedBy={failing ? checklistId : undefined}
      onBlockedTap={failing ? scrollToChecklist : undefined}
      check={() => blocker}
      send={() => onSubmit('/decision', { outcome, rationale: rationale.trim(), cited_evidence_ids: cited })}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Decision</legend>
        {DECISION_CHOICES.map((c) => (
          <ChoiceCard
            key={c.value}
            name="decision-outcome"
            value={c.value}
            checked={outcome === c.value}
            onSelect={() => setOutcome(c.value)}
            title={c.title}
            body={typeof c.body === 'function' ? c.body(detail.flag.rule.appeal_window_days) : c.body}
            tone={c.tone}
          />
        ))}
      </fieldset>
      <RationaleField value={rationale} onChange={setRationale} minLength={failing ? CONFIRMED_RATIONALE_MIN : undefined} />
      <fieldset className="flex flex-col gap-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Evidence this decision relies on (cite at least one)</legend>
        {detail.evidence.map((e) => (
          <label key={e.evidence_id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={cited.includes(e.evidence_id)}
              onChange={() => toggle(e.evidence_id)}
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">{EVIDENCE_LABEL[e.kind]}</span> {e.description}
            </span>
          </label>
        ))}
      </fieldset>
    </FormShell>
  );
}

/** Copy for each appeal outcome. Body shape sent to the server is unchanged: outcome, rationale. */
const APPEAL_CHOICES: { value: AppealOutcome; title: string; body: string }[] = [
  { value: 'upheld', title: 'Uphold the original decision', body: 'The original decision stands. Nothing changes for the learner.' },
  { value: 'overturned', title: 'Overturn it (learner is cleared)', body: 'The original decision is reversed and the learner is cleared.' },
  { value: 'partially_upheld', title: 'Partially uphold', body: 'Part of the original decision stands. Say which part in the rationale.' },
];

/** Single blocker (rationale), so it keeps the one-line hint rather than a checklist. */
export function AppealOutcomeForm({ onSubmit, busy }: FormProps) {
  const [outcome, setOutcome] = useState<AppealOutcome>('upheld');
  const [rationale, setRationale] = useState('');
  const blocker = rationale.trim() ? null : 'Write a rationale to enable submit.';
  return (
    <FormShell
      busy={busy}
      submitLabel="Record appeal outcome"
      blocker={blocker}
      check={() => blocker}
      send={() => onSubmit('/appeal/outcome', { outcome, rationale: rationale.trim() })}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Appeal outcome</legend>
        {APPEAL_CHOICES.map((c) => (
          <ChoiceCard
            key={c.value}
            name="appeal-outcome"
            value={c.value}
            checked={outcome === c.value}
            onSelect={() => setOutcome(c.value)}
            title={c.title}
            body={c.body}
          />
        ))}
      </fieldset>
      <RationaleField value={rationale} onChange={setRationale} />
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

/** True when the server refuses the close inside the appeal window but lets an administrator waive it (the waiver path). */
export const isWaiverClose = (detail: CaseDetail): boolean => {
  const check = detail.action_checks.find((c) => c.action === 'close');
  return check !== undefined && !check.allowed && check.waivable === true;
};

const WAIVER_REASON_MIN = 5;

/** Close for cleared or inconclusive outcomes (body {}); the waiver path adds a checklist and sends waive_appeal_window + reason. */
export function CloseForm({ detail, onSubmit, busy }: FormProps) {
  const [waived, setWaived] = useState(false);
  const [reason, setReason] = useState('');
  if (!isWaiverClose(detail)) {
    return (
      <FormShell busy={busy} submitLabel="Close the case" check={() => null} send={() => onSubmit('/close', {})}>
        <p className="text-sm">
          Close this case for good? The learner cannot appeal this outcome. The closure is recorded in the case history.
        </p>
      </FormShell>
    );
  }
  const end = appealWindowEnd(detail.action_checks.find((c) => c.action === 'close')?.reasons[0]?.message);
  const missing: string[] = [];
  if (!waived) missing.push('tick the waiver box');
  if (reason.trim().length < WAIVER_REASON_MIN) missing.push(`a reason of at least ${WAIVER_REASON_MIN} characters`);
  const blocker = missing.length > 0 ? `Still needed: ${missing.join(' and ')}.` : null;
  return (
    <FormShell
      busy={busy}
      submitLabel="Close and waive appeal window"
      blocker={blocker}
      check={() => blocker}
      send={() => onSubmit('/close', { waive_appeal_window: true, reason: reason.trim() })}
    >
      <div role="note" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm">
        The learner can still appeal {end ? `until ${end}` : 'until the appeal window ends'}. Closing now ends their right to appeal.
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          required
          checked={waived}
          onChange={(e) => setWaived(e.target.checked)}
          className="mt-1 size-4 accent-primary"
        />
        <span>The learner has waived their right to appeal, or an authorised reason applies</span>
      </label>
      <Text label="Reason (kept in the case history)" value={reason} onChange={setReason} />
    </FormShell>
  );
}

/** Stepping aside: one required reason. Body shape sent to the server: reason. */
export function RecuseForm({ onSubmit, busy }: { onSubmit: Submit; busy: boolean }) {
  const [reason, setReason] = useState('');
  const hintId = useId();
  return (
    <FormShell
      busy={busy}
      submitLabel="Step aside"
      check={() => (reason.trim() ? null : 'Give a reason for stepping aside.')}
      send={() => onSubmit('/recuse', { reason: reason.trim() })}
    >
      <p id={hintId} className="text-sm text-muted-foreground">
        Step aside if you have a conflict of interest or cannot review this case fairly. Your reason is recorded in the case history and an
        administrator will assign someone else.
      </p>
      <label className={LABEL}>
        Reason for stepping aside
        <Textarea rows={4} maxLength={2000} value={reason} aria-describedby={hintId} onChange={(e) => setReason(e.target.value)} className="py-2" />
      </label>
    </FormShell>
  );
}
