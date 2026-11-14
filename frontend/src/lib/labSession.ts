// Test Lab session: editor text, last run, filter, run time, expanded cases and the workflow imports. A module-level store
// mirrored to sessionStorage, so navigating away and back (or a reload in the same tab) restores the page. Storage may be
// blocked; then the session simply lives in memory. Writes to storage are debounced; state in memory is always immediate.
import { useSyncExternalStore } from 'react';
import type { LabCase, LabImported, LabResponse } from '../api/lab';

export const LAB_SESSION_KEY = 'yottaflex.lab.session';
// Bump when the stored shape changes: a stored session of any other version is discarded on load.
export const LAB_SESSION_VERSION = 1;
const SAVE_DELAY_MS = 400;

export type LabFilter = 'all' | 'fail' | 'pass';

export interface LabSession {
  version: number;
  text: string;
  response: LabResponse | null;
  cases: LabCase[]; // the cases sent with the last run, in the same order as response.results
  ranAt: string | null;
  filter: LabFilter;
  expanded: string[];
  imported: LabImported[]; // what this browser session wrote to the workflow; kept across Clear so ids are not re-imported
}

const EMPTY: LabSession = {
  version: LAB_SESSION_VERSION,
  text: '',
  response: null,
  cases: [],
  ranAt: null,
  filter: 'all',
  expanded: [],
  imported: [],
};

// ---- Shape checks for stored data. The stored JSON is untrusted: an older build or another writer may have left other data.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNullOr = (guard: (v: unknown) => boolean) => (v: unknown): boolean => v === null || guard(v);
const isArrayOf = (guard: (v: unknown) => boolean) => (v: unknown): boolean => Array.isArray(v) && v.every(guard);
const oneOf =
  <T extends string>(allowed: readonly T[]) =>
  (v: unknown): v is T =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v);

const isBand = oneOf(['no_action', 'log_only', 'review', 'priority_review'] as const);
const isVerdict = oneOf(['pass', 'fail', 'no_expectation'] as const);
const isDismissal = oneOf(['quote_only', 'template_match'] as const);
const isOutcome = oneOf(['case_opened', 'dismissed', 'not_flagged'] as const);
const isFilter = oneOf(['all', 'fail', 'pass'] as const);

const isLabRule = (v: unknown) =>
  isObj(v) &&
  isStr(v.rule_id) &&
  isNum(v.version) &&
  isNum(v.log_threshold) &&
  isNum(v.review_threshold) &&
  isNum(v.priority_threshold) &&
  isNum(v.appeal_window_days);

const isLabReason = (v: unknown) => isObj(v) && isStr(v.code) && isStr(v.message);

const isLabCheck = (v: unknown) => isObj(v) && isStr(v.name) && isBool(v.blocked) && isArrayOf(isLabReason)(v.reasons);

const isExplainStep = (v: unknown) =>
  isObj(v) && isStr(v.step) && isStr(v.text) && (v.value === null || isNum(v.value) || isStr(v.value)) && isNullOr(isNum)(v.threshold);

const isLabResult = (v: unknown) =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.title) &&
  isBool(v.is_flag) &&
  isBool(v.opens_case) &&
  isBand(v.band) &&
  isNum(v.adjusted_score) &&
  isNullOr(isDismissal)(v.dismissal_reason) &&
  isArrayOf(isExplainStep)(v.explanation) &&
  isArrayOf(isLabCheck)(v.checks) &&
  isArrayOf(isStr)(v.mismatches) &&
  isVerdict(v.verdict);

// Checks the fields the Test Lab views read. Other fields are not used here, so they are not required.
export function isValidLabResponse(v: unknown): v is LabResponse {
  return isObj(v) && isLabRule(v.rule) && isNum(v.passed) && isNum(v.failed) && isNum(v.no_expectation) && isArrayOf(isLabResult)(v.results);
}

const isLabCase = (v: unknown) =>
  isObj(v) && isStr(v.id) && isObj(v.scores) && isNum(v.scores.raw) && isNum(v.scores.quoted) && isNum(v.scores.template);

const isLabImported = (v: unknown) =>
  isObj(v) &&
  isStr(v.lab_id) &&
  isStr(v.submission_id) &&
  isStr(v.similarity_report_id) &&
  isOutcome(v.outcome) &&
  isNullOr(isStr)(v.case_id) &&
  isArrayOf(isStr)(v.evidence_ids);

export function isValidSession(v: unknown): v is LabSession {
  return (
    isObj(v) &&
    v.version === LAB_SESSION_VERSION &&
    isStr(v.text) &&
    isNullOr(isValidLabResponse)(v.response) &&
    isArrayOf(isLabCase)(v.cases) &&
    isNullOr(isStr)(v.ranAt) &&
    isFilter(v.filter) &&
    isArrayOf(isStr)(v.expanded) &&
    isArrayOf(isLabImported)(v.imported)
  );
}

// Loads the stored session only when it matches the current shape and version; anything else is cleared.
function readStorage(): LabSession {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(LAB_SESSION_KEY);
  } catch {
    return EMPTY; // storage blocked: the session lives in memory
  }
  if (raw === null) return EMPTY;
  let data: unknown = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (isValidSession(data)) return data;
  try {
    window.sessionStorage.removeItem(LAB_SESSION_KEY);
  } catch {
    // Storage blocked: nothing to remove.
  }
  return EMPTY;
}

let state: LabSession = readStorage();
const listeners = new Set<() => void>();

// Debounced persistence: a keystroke updates memory and listeners at once, and the JSON is written once input settles.
let saveTimer: number | undefined;

function writeStorage() {
  try {
    window.sessionStorage.setItem(LAB_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked or full: the session still works in memory until the tab closes.
  }
}

function scheduleSave() {
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined;
    writeStorage();
  }, SAVE_DELAY_MS);
}

// Writes a pending save now. Runs on pagehide/beforeunload so the last keystrokes survive leaving the page.
export function flushLabSession() {
  if (saveTimer === undefined) return;
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  writeStorage();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushLabSession);
  window.addEventListener('beforeunload', flushLabSession);
}

function commit(next: LabSession) {
  state = next;
  scheduleSave();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

export const getLabSession = () => state;
export const useLabSession = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export function updateLabSession(patch: Partial<LabSession>) {
  commit({ ...state, ...patch });
}

// Clears the editor and the last run. Imports stay: the workflow already holds those cases.
export function clearLabSession() {
  commit({ ...EMPTY, imported: state.imported });
}

// Stable key for a case row: its position in the run plus its id (ids may repeat in pasted input).
export const caseKey = (index: number, id: string) => `${index}:${id}`;

// A new run stores its results and cases, and opens the failed cases, so a reviewer sees the mismatches first.
export function recordLabRun(response: LabResponse, cases: LabCase[] = []) {
  const expanded = response.results.flatMap((r, i) => (r.verdict === 'fail' ? [caseKey(i, r.id)] : []));
  commit({ ...state, response, cases, ranAt: new Date().toISOString(), expanded });
}

// Stores the created rows by lab id. A repeated id replaces its earlier row (the server would have refused the duplicate).
export function recordLabImport(created: LabImported[]) {
  const ids = new Set(created.map((c) => c.lab_id));
  commit({ ...state, imported: [...state.imported.filter((i) => !ids.has(i.lab_id)), ...created] });
}

export function importedById(imported: LabImported[]): Map<string, LabImported> {
  return new Map(imported.map((i) => [i.lab_id, i]));
}

// The double-import rule: a lab id already imported in this session is skipped, and so is a repeat inside the same batch.
export function partitionImportable(cases: LabCase[], imported: LabImported[]): { importable: LabCase[]; skipped: string[] } {
  const seen = new Set(imported.map((i) => i.lab_id));
  const importable: LabCase[] = [];
  const skipped: string[] = [];
  for (const c of cases) {
    if (seen.has(c.id)) {
      skipped.push(c.id);
    } else {
      seen.add(c.id);
      importable.push(c);
    }
  }
  return { importable, skipped };
}
