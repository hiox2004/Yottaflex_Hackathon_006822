// One case result as a disclosure row: a button with the verdict and key facts (inline content only), and a region below it
// with the checks, mismatches and triage steps. Open state is controlled by the page so it survives navigation (see
// lib/labSession.ts). An imported case shows its chip and link in a footer row; an unimported case offers "Import this case"
// when opened.
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import type { Band, LabCheck, LabImported, LabResult } from '../../api/lab';
import { Badge, type Tone } from '../ui/badge';
import { Button } from '../ui/button';
import { ImportAccessNotice, ImportedLink, type ImportAccess } from './ImportPanel';

const CHECK_LABELS: Record<string, string> = {
  reviewer_assignment: 'Reviewer assignment',
  appeal_reviewer_independence: 'Appeal reviewer independence',
  decision: 'Decision',
  late_evidence: 'Evidence after decision',
};

const VERDICT: Record<LabResult['verdict'], { label: string; tone: Tone }> = {
  pass: { label: 'Passed', tone: 'success' },
  fail: { label: 'Failed', tone: 'danger' },
  no_expectation: { label: 'No expectation', tone: 'neutral' },
};

const bandLabel = (band: Band) => band.replace('_', ' ');

// Spans only: this sits inside the disclosure button, which allows phrasing content only.
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </span>
  );
}

function CheckRow({ check }: { check: LabCheck }) {
  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{CHECK_LABELS[check.name] ?? check.name}</span>
        <Badge tone={check.blocked ? 'danger' : 'success'}>{check.blocked ? 'Blocked' : 'Clear'}</Badge>
      </div>
      {check.reasons.map((r) => (
        <p key={r.code} className="text-sm text-muted-foreground">
          <span className="font-mono text-xs">{r.code}</span> {r.message}
        </p>
      ))}
    </li>
  );
}

interface Props {
  result: LabResult;
  open: boolean;
  onToggle: () => void;
  imported?: LabImported;
  access: ImportAccess;
  importing: boolean;
  onImport: () => void;
}

export function CaseResult({ result, open, onToggle, imported, access, importing, onImport }: Props) {
  const verdict = VERDICT[result.verdict];
  const Chevron = open ? ChevronDown : ChevronRight;
  const triggerId = `${useId()}-trigger`;
  const panelId = `${triggerId}-panel`;

  return (
    <li className="rounded-lg border bg-card">
      <h3 className="m-0 text-base font-normal">
        <button
          id={triggerId}
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Chevron className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="block min-w-0">
              {/* Plain text on purpose: the id is a label from the pasted input, not a link to a stored case. */}
              <span className="block font-mono text-xs text-muted-foreground">{result.id}</span>
              <span className="block truncate text-sm font-medium">{result.title || 'Untitled case'}</span>
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-6 sm:pl-0">
            <Fact label="Flag">{result.is_flag ? 'Yes' : 'No'}</Fact>
            <Fact label="Case opened">{result.opens_case ? 'Yes' : 'No'}</Fact>
            <Fact label="Band">
              <span className="capitalize">{bandLabel(result.band)}</span>
            </Fact>
            <Fact label="Adjusted">
              <span className="font-mono">{result.adjusted_score.toFixed(2)}</span>
            </Fact>
            <Badge tone={verdict.tone}>{verdict.label}</Badge>
            {imported && <Badge tone="primary">Imported</Badge>}
          </span>
        </button>
      </h3>

      {imported && (
        <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">Imported to the workflow:</span>
          <ImportedLink imported={imported} />
        </div>
      )}

      <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!open}>
        {open && (
          <>
            {!imported && (
              <div className="flex flex-col gap-3 border-t p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="outline" disabled={!access.allowed || importing} onClick={onImport} aria-busy={importing}>
                    {importing && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    {importing ? 'Importing...' : 'Import this case'}
                  </Button>
                </div>
                <ImportAccessNotice access={access} />
              </div>
            )}

            <div className="grid gap-5 border-t p-4 lg:grid-cols-2">
              <section className="flex flex-col gap-2">
                <h4 className="text-xs font-medium uppercase text-muted-foreground">Exception checks</h4>
                {result.checks.length === 0 && <p className="text-sm text-muted-foreground">No reviewer, decision or evidence in this case.</p>}
                <ul className="flex flex-col gap-2">
                  {result.checks.map((c) => (
                    <CheckRow key={c.name} check={c} />
                  ))}
                </ul>
                {result.dismissal_reason && (
                  <p className="text-sm text-muted-foreground">
                    Auto-dismissed: <span className="font-mono text-xs">{result.dismissal_reason}</span>
                  </p>
                )}
                {result.mismatches.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-md border border-danger/30 bg-danger/10 p-3">
                    <h5 className="text-xs font-medium uppercase text-danger">Expected vs got</h5>
                    <ul className="flex flex-col gap-1 font-mono text-xs text-danger">
                      {result.mismatches.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h4 className="text-xs font-medium uppercase text-muted-foreground">How the engine decided</h4>
                <ol className="flex flex-col gap-2">
                  {result.explanation.map((s, i) => (
                    <li key={`${s.step}-${i}`} className="flex gap-3 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {i + 1}
                      </span>
                      <span>{s.text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </>
        )}
      </div>
    </li>
  );
}
