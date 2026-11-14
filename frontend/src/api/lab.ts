// Test Lab API: TS mirrors of the backend lab models (services/lab_service.py), the run mutation, and input/error helpers.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recordLabImport, recordLabRun } from '../lib/labSession';
import { apiPost } from './client';
import { ApiError } from './errors';
import type { EvidenceKind } from './types';

export type Role = 'instructor' | 'academic_reviewer' | 'academic_administrator' | 'support_staff';
export type Band = 'no_action' | 'log_only' | 'review' | 'priority_review';
export type DismissalReason = 'quote_only' | 'template_match';

export interface LabScores {
  raw: number;
  quoted: number;
  template: number;
}

export interface LabReviewer {
  reviewer_id: string;
  role?: Role; // default academic_reviewer
  department: string;
  learner_department: string;
  assessment_instructor_id?: string; // default INS-NONE
  reviewed_learner_before?: boolean;
  on_case?: boolean;
  decided_case?: boolean;
}

export interface LabDecision {
  outcome: 'no_violation' | 'violation_confirmed' | 'inconclusive';
  reviewer_id?: string | null;
  rationale?: string;
}

export interface LabLateEvidence {
  case_reopened_first: boolean;
}

export interface LabExpect {
  is_flag?: boolean;
  opens_case?: boolean;
  band?: Band;
  dismissal_reason?: DismissalReason;
  reviewer_blocked?: boolean;
  appeal_reviewer_blocked?: boolean;
  decision_blocked?: boolean;
  evidence_blocked?: boolean;
}

export interface LabEvidence {
  kind: EvidenceKind;
  description: string;
}

export interface LabCase {
  id: string;
  title?: string;
  scores: LabScores;
  reviewer?: LabReviewer;
  appeal_reviewer?: LabReviewer;
  decision?: LabDecision;
  late_evidence?: LabLateEvidence;
  expect?: LabExpect;
  evidence?: LabEvidence[]; // max 6; ignored by /lab/run, written to the case by /lab/import
}

export interface LabRequest {
  cases: LabCase[];
}

// Import body: a lab case plus the optional links the imported submission needs (contract: POST /api/lab/import).
export interface LabImportCase extends LabCase {
  learner_id?: string;
  assessment_id?: string;
}

export type LabImportOutcome = 'case_opened' | 'dismissed' | 'not_flagged';

export interface LabImported {
  lab_id: string;
  submission_id: string;
  similarity_report_id: string;
  outcome: LabImportOutcome;
  case_id: string | null;
  evidence_ids: string[];
}

export interface LabImportResponse {
  created: LabImported[];
}

export interface LabReason {
  code: string;
  message: string;
}

export interface LabCheck {
  name: string;
  blocked: boolean;
  reasons: LabReason[];
}

export interface LabExplainStep {
  step: string;
  text: string;
  value: number | string | null;
  threshold: number | null;
}

export interface LabResult {
  id: string;
  title: string;
  is_flag: boolean;
  opens_case: boolean;
  band: Band;
  adjusted_score: number;
  dismissal_reason: DismissalReason | null;
  explanation: LabExplainStep[];
  checks: LabCheck[];
  mismatches: string[];
  verdict: 'pass' | 'fail' | 'no_expectation';
}

export interface LabRule {
  rule_id: string;
  version: number;
  log_threshold: number;
  review_threshold: number;
  priority_threshold: number;
  appeal_window_days: number;
}

export interface LabResponse {
  rule: LabRule;
  passed: number;
  failed: number;
  no_expectation: number;
  results: LabResult[];
}

export function useLabRun() {
  // Recorded in the store on success (not in the page), so the results survive navigating away mid-run.
  return useMutation({
    mutationFn: (body: LabRequest) => apiPost<LabResponse>('/lab/run', body),
    onSuccess: (response, body) => recordLabRun(response, body.cases),
  });
}

// Writes the cases as real submissions, flags and (when opened) cases. Only an academic administrator may import.
// Cases and Dismissed flags are refetched at once, so the import shows up there without a reload.
export function useLabImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (cases: LabImportCase[]) => apiPost<LabImportResponse>('/lab/import', { cases }),
    onSuccess: (response) => {
      recordLabImport(response.created);
      void client.invalidateQueries({ queryKey: ['queue'] });
      void client.invalidateQueries({ queryKey: ['flags'] });
    },
  });
}

// Reads pasted text: strips markdown fences, then requires {"cases": [...]} (a bare array is accepted too).
export function parseLabInput(text: string): LabRequest {
  const cleaned = text.trim().replace(/^```[\w-]*\s*/, '').replace(/\s*```$/, '');
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  const cases = Array.isArray(data) ? data : (data as { cases?: unknown } | null)?.cases;
  if (!Array.isArray(cases)) throw new Error('Expected a JSON object with a "cases" array.');
  return { cases: cases as LabCase[] };
}

interface Problem {
  field?: unknown;
  problem?: unknown;
  msg?: unknown;
  loc?: unknown;
}

// Friendly text for any failure. A 422 lists the offending fields (our envelope or FastAPI's detail list).
export function labErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 422) {
    const list = (error.details.problems ?? error.details.detail) as Problem[] | undefined;
    if (Array.isArray(list) && list.length > 0) {
      const lines = list.slice(0, 5).map((p) => {
        const where = String(p.field ?? (Array.isArray(p.loc) ? p.loc.join('.') : 'cases'));
        return `${where.replace(/^body\./, '')}: ${String(p.problem ?? p.msg ?? 'invalid')}`;
      });
      return `The cases do not match the expected format. ${lines.join('; ')}`;
    }
    return 'The cases do not match the expected format.';
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Only an academic administrator can import cases into the workflow. Switch to an administrator and try again.';
  }
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'The API is not reachable. Start the backend and try again.';
  return error instanceof Error ? error.message : 'Something went wrong.';
}
