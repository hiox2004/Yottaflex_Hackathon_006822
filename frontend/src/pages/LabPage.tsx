// Test Lab page: prompt for an external AI, paste its JSON, run it through the real rules, read the verdicts, and
// optionally import the cases into the workflow. Input, results and imports live in the lab session store
// (lib/labSession.ts), so they survive navigation and reloads.
import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { labErrorMessage, parseLabInput, useLabImport, useLabRun, type LabCase, type LabImportCase, type LabRequest } from '../api/lab';
import { useReviewers } from '../api/hooks';
import { CaseInput } from '../components/lab/CaseInput';
import { ImportPanel, type ImportAccess } from '../components/lab/ImportPanel';
import { PackPicker, type PackFeedback } from '../components/lab/PackPicker';
import { PromptCard } from '../components/lab/PromptCard';
import { ResultsErrorBoundary } from '../components/lab/ResultsErrorBoundary';
import { ResultsPanel } from '../components/lab/ResultsPanel';
import { ROLE_LABEL } from '../labels';
import { allPacks, type LabPack } from '../lib/labPacks';
import { LAB_PROMPT } from '../lib/labPrompt';
import { clearLabSession, partitionImportable, updateLabSession, useLabSession } from '../lib/labSession';
import { useSession } from '../session';

// Import needs an academic administrator. Reviewers are read only to explain the block; the server still decides.
function useImportAccess(): ImportAccess {
  const { actorId } = useSession();
  const reviewers = useReviewers(actorId);
  if (reviewers.isError) return { allowed: true, reason: null };
  const me = reviewers.data?.find((r) => r.reviewer_id === actorId);
  if (me?.role === 'academic_administrator') return { allowed: true, reason: null };
  if (!me) {
    return {
      allowed: false,
      reason: reviewers.isLoading
        ? 'Checking your role...'
        : 'Only an academic administrator can import cases. The acting user is not in the staff list.',
    };
  }
  return { allowed: false, reason: `Only an academic administrator can import cases. You are acting as ${me.name} (${ROLE_LABEL[me.role]}).` };
}

export function LabPage() {
  const session = useLabSession();
  const [parseError, setParseError] = useState<string | null>(null);
  const run = useLabRun();
  const imports = useLabImport();
  const access = useImportAccess();
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollOnRun = useRef(false);
  const inFlight = useRef<Set<string>>(new Set());

  // The import works on the cases of the last run. They are only usable when they line up with the results row by row.
  const runCases: LabCase[] = session.response && session.cases.length === session.response.results.length ? session.cases : [];
  const verdicts = session.response?.results.map((r) => r.verdict) ?? [];

  // Scroll to the results only when a run started on this page finishes, not when a saved session is restored.
  useEffect(() => {
    if (!scrollOnRun.current || !session.ranAt) return;
    scrollOnRun.current = false;
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [session.ranAt]);

  // Parses and runs the given text. Returns false (and shows the error inline) when the text is not a valid case list.
  const runText = (text: string) => {
    let request: LabRequest;
    try {
      request = parseLabInput(text);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'The input could not be read.');
      return false;
    }
    setParseError(null);
    scrollOnRun.current = true;
    // On failure the store keeps the previous results; only the error alert below changes.
    run.mutate(request, { onError: () => (scrollOnRun.current = false) });
    return true;
  };

  const onRun = () => runText(session.text);

  const loadPack = (pack: LabPack) => {
    updateLabSession({ text: JSON.stringify({ cases: pack.cases }, null, 2) });
    setParseError(null);
  };

  const loadAndRunPack = (pack: LabPack) => {
    const text = JSON.stringify({ cases: pack.cases }, null, 2);
    updateLabSession({ text });
    runText(text);
  };

  // Adds the pack's cases after the editor's cases. An id already in the editor is skipped, so ids stay unique.
  const appendPack = (pack: LabPack): PackFeedback => {
    let existing: LabCase[] = [];
    if (session.text.trim() !== '') {
      try {
        existing = parseLabInput(session.text).cases;
      } catch {
        return { tone: 'error', text: 'The editor does not hold valid cases, so nothing was appended. Fix the JSON or load a pack first.' };
      }
    }
    const ids = new Set(existing.map((c) => c.id));
    const added = pack.cases.filter((c) => !ids.has(c.id));
    const skipped = pack.cases.length - added.length;
    updateLabSession({ text: JSON.stringify({ cases: [...existing, ...added] }, null, 2) });
    setParseError(null);
    const note = skipped > 0 ? ` ${skipped} already in the editor were skipped.` : '';
    return { tone: 'ok', text: `Appended ${added.length} of ${pack.cases.length} cases from "${pack.title}".${note}` };
  };

  const onClear = () => {
    clearLabSession();
    run.reset();
    setParseError(null);
  };

  const onToggle = (key: string) => {
    const open = session.expanded.includes(key);
    updateLabSession({ expanded: open ? session.expanded.filter((k) => k !== key) : [...session.expanded, key] });
  };

  // Second guard on top of the panel's: a lab id imported in this session is never sent again, and an id whose request is
  // still in flight is not sent twice (a ref, so two clicks before the next render are still caught).
  const importCases = (cases: LabImportCase[]) => {
    const { importable } = partitionImportable(cases, session.imported);
    const fresh = importable.filter((c) => !inFlight.current.has(c.id));
    if (fresh.length === 0) return;
    fresh.forEach((c) => inFlight.current.add(c.id));
    const release = () => fresh.forEach((c) => inFlight.current.delete(c.id));
    // mutateAsync, not mutate: mutate's callbacks are dropped when a newer import starts, which would leave ids stuck in flight.
    void imports.mutateAsync(fresh).catch(() => undefined).finally(release);
  };

  const importOne = (index: number) => {
    const lab = runCases[index];
    if (lab) importCases([lab]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Test Lab</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Check the rules with test cases written by any AI. The real engine evaluates each case against its expectation. Nothing is stored
          unless you import the cases into the workflow below.
        </p>
      </div>

      <PromptCard prompt={LAB_PROMPT} />

      <PackPicker
        packs={allPacks}
        disabled={run.isPending}
        onLoad={loadPack}
        onLoadAndRun={loadAndRunPack}
        onAppend={appendPack}
      />

      <CaseInput
        value={session.text}
        onChange={(text) => updateLabSession({ text })}
        onRun={onRun}
        onClear={onClear}
        parseError={parseError}
        running={run.isPending}
      />

      {run.isError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{labErrorMessage(run.error)}</p>
        </div>
      )}

      {session.response && (
        <div ref={resultsRef} className="flex flex-col gap-6">
          {/* Keyed by the run time: a new run gets a fresh boundary, so a failed render does not stick across runs. */}
          <ResultsErrorBoundary key={session.ranAt ?? 'none'} onClear={onClear}>
            <ResultsPanel
              response={session.response}
              ranAt={session.ranAt}
              filter={session.filter}
              expanded={session.expanded}
              onFilterChange={(filter) => updateLabSession({ filter })}
              onToggle={onToggle}
              imported={session.imported}
              access={access}
              importing={imports.isPending}
              onImportOne={importOne}
            />
          </ResultsErrorBoundary>
        </div>
      )}

      {(session.response || session.imported.length > 0) && (
        <ImportPanel
          cases={runCases}
          verdicts={verdicts}
          imported={session.imported}
          access={access}
          pending={imports.isPending}
          error={imports.error}
          result={imports.data}
          onImport={importCases}
        />
      )}
    </div>
  );
}
