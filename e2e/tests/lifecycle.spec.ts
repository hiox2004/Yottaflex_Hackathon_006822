// Core workflow through the real UI, with real writes. Two journeys on cases chosen at runtime from the API:
//   A 'cleared'        open -> assign -> under review -> evidence -> clear -> decided (close blocked by appeal window)
//   B 'failed + appeal' open -> assign -> fail -> appeal -> appeal reviewer -> reassign -> overturn -> closed
// Selectors use roles, labels and visible text only. Serial: journey B depends on the case rules, not on A's state.
import { devices, expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { actAs } from './helpers';

const API = 'http://localhost:8000/api';
const ADMIN = 'REV-000001'; // Vik Silva, academic administrator
const SUPPORT = 'REV-000007'; // Sam Gupta, support staff
/** Pinned demo case: excluded so the demo record is never touched by the test run. */
const PINNED = 'CAS-2026-000300';
/** Reviewer roles that may record decisions (backend REVIEWER_ROLES). */
const REVIEWER_ROLE_SET = new Set(['instructor', 'academic_reviewer']);

const EVIDENCE_A = 'Paragraph 3 overlaps a shared assignment template phrase';
const RATIONALE_CLEAR = 'Overlap is limited to a shared assignment template phrase, so no action against the learner.';
const EVIDENCE_B = 'Paragraph 5 matches a published article word for word';
const RATIONALE_FAIL = 'Passage copied verbatim from the source with no quotation marks or citation.';
const GROUNDS = 'I was not given the chance to explain the quoted passage before the decision was made.';
const RATIONALE_OVERTURN = 'On review the passage is properly attributed in the references, so the decision is reversed.';

const SCREENS = 'C:/CandidateWorkspace/e2e/results/screens';

interface Reviewer {
  reviewer_id: string;
  name: string;
  role: string;
  department: string;
}
interface Eligible extends Reviewer {
  eligible: boolean;
  reasons: { code: string; message: string }[];
}
interface QueueItem {
  case_id: string;
  assignee_ids: string[];
}

const contexts: BrowserContext[] = [];
let caseA = '';
let caseB = '';
let reviewerA: Reviewer;
let reviewerB: Reviewer;
let appealOne: Reviewer;
let appealTwo: Reviewer;

test.describe.configure({ mode: 'serial', timeout: 90_000 });
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Name-only radio/listitem match. Reviewer names are unique within the picked set (checked when picking). */
const byName = (name: string) => new RegExp(`^${esc(name)}`);

async function api<T>(path: string, actor = ADMIN): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'X-Actor-Id': actor } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

/** A queue case with no reviewer yet, that has at least one eligible academic reviewer and at least one ineligible one. */
async function pickCase(exclude: string[]): Promise<{ caseId: string; reviewer: Reviewer }> {
  const queue = await api<{ items: QueueItem[] }>('/queue?status=open&limit=50');
  const everyone = await api<Reviewer[]>('/reviewers');
  const nameCount = new Map<string, number>();
  for (const r of everyone) nameCount.set(r.name, (nameCount.get(r.name) ?? 0) + 1);
  for (const item of queue.items) {
    if (exclude.includes(item.case_id) || item.case_id === PINNED || item.assignee_ids.length > 0) continue;
    const detail = await api<{ reviewers: unknown[] }>(`/cases/${item.case_id}`);
    if (detail.reviewers.length > 0) continue;
    const eligible = await api<Eligible[]>(`/cases/${item.case_id}/eligible-reviewers?purpose=case`);
    const pick = eligible.find((e) => e.eligible && e.role === 'academic_reviewer' && nameCount.get(e.name) === 1);
    if (pick && eligible.some((e) => !e.eligible)) return { caseId: item.case_id, reviewer: pick };
  }
  throw new Error('No suitable open case in the queue');
}

async function openAs(browser: Browser, reviewerId: string, caseId: string): Promise<Page> {
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  contexts.push(context);
  const page = await context.newPage();
  await actAs(page, reviewerId);
  await page.goto(`/cases/${caseId}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return page;
}

const actions = (page: Page): Locator => page.getByRole('region', { name: 'Actions' });
const rail = (page: Page): Locator => page.getByRole('region', { name: 'Case progress' });
const currentStep = (page: Page): Locator => rail(page).locator('[aria-current="step"]');
const timeline = (page: Page): Locator => page.getByRole('region', { name: 'Timeline' });
const button = (scope: Locator | Page, name: string): Locator => scope.getByRole('button', { name, exact: true });
const dialogOf = (page: Page): Locator => page.getByRole('dialog');

async function shot(page: Page, name: string): Promise<string> {
  const path = `${SCREENS}/lifecycle-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

test('JOURNEY A: cleared', async ({ browser }) => {
  const picked = await pickCase([]);
  caseA = picked.caseId;
  reviewerA = picked.reviewer;

  // Admin tab 1 opens the assign dialog and keeps it open, so a later submit can be refused as stale.
  const adminStale = await openAs(browser, ADMIN, caseA);
  await expect(currentStep(adminStale)).toHaveText(/Open/);
  await button(actions(adminStale), 'Assign a reviewer').click();
  await expect(dialogOf(adminStale).getByRole('radio', { name: byName(reviewerA.name) })).toBeVisible();

  // Admin tab 2 assigns for real.
  const admin = await openAs(browser, ADMIN, caseA);
  await button(actions(admin), 'Assign a reviewer').click();
  const assignDialog = dialogOf(admin);
  await expect(assignDialog.getByText(/^Not available:/).first()).toBeVisible();
  await assignDialog.getByRole('radio', { name: byName(reviewerA.name) }).check();
  await button(assignDialog, 'Assign').click();
  await expect(dialogOf(admin)).toBeHidden();
  await expect(admin.getByText(/Next: reviewer records a decision/)).toBeVisible();
  await expect(currentStep(admin)).toHaveText(/Under review/);
  await expect(timeline(admin)).toContainText('Reviewer assigned');

  // The stale tab submits the same reviewer again: the server refuses it with a plain-language message.
  await dialogOf(adminStale).getByRole('radio', { name: byName(reviewerA.name) }).check();
  await button(dialogOf(adminStale), 'Assign').click();
  const refusal = dialogOf(adminStale).getByRole('alert');
  await expect(refusal).toContainText('already assigned to the case');
  await shot(adminStale, 'A-stale-assign-refusal');
  await adminStale.close();

  // Support staff: no decision action, with the reason.
  const support = await openAs(browser, SUPPORT, caseA);
  await expect(currentStep(support)).toHaveText(/Under review/);
  await expect(button(actions(support), 'Record a decision')).toHaveCount(0);
  await actions(support).getByText(/^Not available \(\d+\)$/).click();
  await expect(actions(support).getByRole('listitem').filter({ hasText: 'Record a decision' })).toContainText('Only reviewers can record a decision');

  // The assigned reviewer adds evidence and records a clearing decision.
  const reviewer = await openAs(browser, reviewerA.reviewer_id, caseA);
  await button(actions(reviewer), 'Add evidence').click();
  await dialogOf(reviewer).getByLabel('Kind').selectOption('matched_passage');
  await dialogOf(reviewer).getByLabel('Description').fill(EVIDENCE_A);
  await button(dialogOf(reviewer), 'Add evidence').click();
  await expect(dialogOf(reviewer)).toBeHidden();
  await expect(reviewer.getByText(EVIDENCE_A)).toBeVisible();

  await button(actions(reviewer), 'Record a decision').click();
  const decide = dialogOf(reviewer);
  await decide.getByRole('radio', { name: /Clear the learner/ }).check();
  await decide.getByRole('checkbox', { name: new RegExp(esc(EVIDENCE_A)) }).check();
  await decide.getByLabel('Rationale').fill(RATIONALE_CLEAR);
  await button(decide, 'Clear learner').click();
  await expect(dialogOf(reviewer)).toBeHidden();
  await expect(reviewer.getByText('Cleared', { exact: true })).toBeVisible();
  await expect(currentStep(reviewer)).toHaveText(/Decided/);
  await expect(timeline(reviewer)).toContainText('Decision recorded');

  // Admin: closing is blocked by the open appeal window, so it is not offered and the reason is shown.
  await admin.reload();
  await expect(button(actions(admin), 'Close the case')).toHaveCount(0);
  await actions(admin).getByText(/^Not available \(\d+\)$/).click();
  await expect(actions(admin).getByText(/The appeal window is still open until/)).toBeVisible();
  await expect(currentStep(admin)).toHaveText(/Decided/);
  await expect(admin.getByText(/Decided: learner cleared/)).toBeVisible();
});

test('JOURNEY B: failed + appeal', async ({ browser }) => {
  const picked = await pickCase([caseA]);
  caseB = picked.caseId;
  reviewerB = picked.reviewer;

  const admin = await openAs(browser, ADMIN, caseB);
  await button(actions(admin), 'Assign a reviewer').click();
  await dialogOf(admin).getByRole('radio', { name: byName(reviewerB.name) }).check();
  await button(dialogOf(admin), 'Assign').click();
  await expect(currentStep(admin)).toHaveText(/Under review/);

  // Reviewer adds a matched passage and confirms the violation.
  const reviewer = await openAs(browser, reviewerB.reviewer_id, caseB);
  await button(actions(reviewer), 'Add evidence').click();
  await dialogOf(reviewer).getByLabel('Kind').selectOption('matched_passage');
  await dialogOf(reviewer).getByLabel('Description').fill(EVIDENCE_B);
  await button(dialogOf(reviewer), 'Add evidence').click();
  await expect(reviewer.getByText(EVIDENCE_B)).toBeVisible();

  await button(actions(reviewer), 'Record a decision').click();
  const fail = dialogOf(reviewer);
  await fail.getByRole('radio', { name: /Fail: violation confirmed/ }).check();
  await fail.getByRole('checkbox', { name: /I have reviewed the cited evidence myself/ }).check();
  await fail.getByRole('checkbox', { name: new RegExp(esc(EVIDENCE_B)) }).check();
  await fail.getByLabel('Rationale').fill(RATIONALE_FAIL);
  await button(fail, 'Confirm violation').click();
  await expect(dialogOf(reviewer)).toBeHidden();
  await expect(reviewer.getByText('Failed (violation confirmed)', { exact: true })).toBeVisible();
  await expect(currentStep(reviewer)).toHaveText(/Decided/);

  // Support staff files the appeal.
  const support = await openAs(browser, SUPPORT, caseB);
  await button(actions(support), 'File an appeal').click();
  await dialogOf(support).getByLabel('Grounds for the appeal').fill(GROUNDS);
  await button(dialogOf(support), 'File appeal').click();
  await expect(dialogOf(support)).toBeHidden();
  await expect(support.getByText(/Appeal filed\. Waiting for an administrator/)).toBeVisible();

  // Admin assigns an independent appeal reviewer; the original reviewer must be shown as ineligible.
  const appealPool = (await api<Eligible[]>(`/cases/${caseB}/eligible-reviewers?purpose=appeal`)).filter(
    (e) => e.eligible && REVIEWER_ROLE_SET.has(e.role) && e.reviewer_id !== reviewerB.reviewer_id,
  );
  const [firstAppeal, secondAppeal] = appealPool;
  expect(secondAppeal, 'two independent appeal reviewers exist').toBeDefined();
  appealOne = firstAppeal;
  appealTwo = secondAppeal;

  await admin.reload();
  await button(actions(admin), 'Assign appeal reviewer').click();
  const pick = dialogOf(admin);
  const originalRadio = pick.getByRole('radio', { name: byName(reviewerB.name) });
  await expect(originalRadio).toBeDisabled();
  await expect(pick.getByRole('listitem').filter({ hasText: byName(reviewerB.name) }).first()).toContainText(/Not available:/);
  await pick.getByRole('radio', { name: byName(appealOne.name) }).check();
  await button(pick, 'Assign').click();
  await expect(dialogOf(admin)).toBeHidden();
  await expect(admin.getByText(new RegExp(`Appeal under review by ${esc(appealOne.name)}`))).toBeVisible();

  // Reassign to a second independent person; the timeline records the change.
  await admin.reload();
  await button(actions(admin), 'Reassign appeal reviewer').click();
  const reassign = dialogOf(admin);
  await reassign.getByRole('radio', { name: byName(appealTwo.name) }).check();
  await button(reassign, 'Reassign').click();
  await expect(dialogOf(admin)).toBeHidden();
  await expect(admin.getByText(new RegExp(`Appeal under review by ${esc(appealTwo.name)}`))).toBeVisible();
  await expect(timeline(admin).getByText('Appeal reviewer assigned')).toHaveCount(2);

  // The named appeal reviewer decides: overturn.
  const appealer = await openAs(browser, appealTwo.reviewer_id, caseB);
  await button(actions(appealer), 'Decide the appeal').click();
  const decide = dialogOf(appealer);
  await decide.getByRole('radio', { name: /Overturn it/ }).check();
  await decide.getByLabel('Rationale').fill(RATIONALE_OVERTURN);
  await button(decide, 'Record appeal outcome').click();
  await expect(dialogOf(appealer)).toBeHidden();
  await expect(appealer.getByText(/Appeal decided\. Waiting for an administrator/)).toBeVisible();
  await shot(appealer, 'B-appeal-decided');

  // Admin closes the case.
  await admin.reload();
  await button(actions(admin), 'Close the case').click();
  await button(dialogOf(admin), 'Close the case').click();
  await expect(dialogOf(admin)).toBeHidden();
  await expect(admin.getByText('This case is closed and final.')).toBeVisible();
  await expect(currentStep(admin)).toHaveText(/Closed/);
  await shot(admin, 'B-closed');
});
