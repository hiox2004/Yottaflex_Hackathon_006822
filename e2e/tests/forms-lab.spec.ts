// Forms and Test Lab, through the real UI. Read-only by design: the decision form is checked up to the
// submit button and never submitted, the evidence and appeal forms are not touched, and Import is never clicked.
// Cases and reviewers are chosen at runtime from the API. Selectors use roles, labels and visible text only.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { actAs } from './helpers';

const API = 'http://localhost:8000/api';
const ADMIN = 'REV-000001'; // Vik Silva, academic administrator
const SUPPORT = 'REV-000007'; // Sam Gupta, support staff
const DECIDER_ROLES = new Set(['instructor', 'academic_reviewer']);
const INCRIMINATING = ['matched_passage', 'source_reference'];
const LAB_ORIGIN = 'http://localhost:5173';

const SHORT_RATIONALE = 'Too short.'; // 10 characters
const LONG_RATIONALE = 'Passage copied verbatim from the source with no quotation marks or citation.';
const CLEAR_RATIONALE = 'Overlap is limited to a shared assignment template phrase, so no action against the learner.';

interface Reviewer {
  reviewer_id: string;
  name: string;
  role: string;
}
interface QueueItem {
  case_id: string;
  assignee_ids: string[];
}
interface Evidence {
  evidence_id: string;
  kind: string;
  description: string;
}
interface CaseDetail {
  case_id: string;
  evidence: Evidence[];
}

async function api<T>(path: string, actor = ADMIN): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'X-Actor-Id': actor } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

/** An under_review case with an assigned academic reviewer and at least one incriminating evidence item. */
async function pickDecisionCase(): Promise<{ caseId: string; reviewerId: string; incriminating: Evidence }> {
  const queue = await api<{ items: QueueItem[] }>('/queue?status=under_review&limit=5');
  const staff = await api<Reviewer[]>('/reviewers');
  const deciders = new Set(staff.filter((r) => DECIDER_ROLES.has(r.role)).map((r) => r.reviewer_id));
  for (const item of queue.items) {
    const reviewerId = item.assignee_ids.find((id) => deciders.has(id));
    if (!reviewerId) continue;
    const detail = await api<CaseDetail>(`/cases/${item.case_id}`);
    const incriminating = detail.evidence.find((e) => INCRIMINATING.includes(e.kind));
    if (incriminating) return { caseId: item.case_id, reviewerId, incriminating };
  }
  throw new Error('No under_review case with an assigned reviewer and an incriminating evidence item');
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const actions = (page: Page): Locator => page.getByRole('region', { name: 'Actions' });
const dialogOf = (page: Page): Locator => page.getByRole('dialog');
const checklistOf = (page: Page): Locator => dialogOf(page).getByRole('region', { name: 'Before you can confirm' });
const packCard = (page: Page, title: string): Locator =>
  page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const summaryLine = (page: Page): Locator => page.getByText(/^Last run /);
const labInput = (page: Page): Locator => page.getByRole('textbox', { name: 'Test cases JSON' });
const importButton = (page: Page): Locator => page.getByRole('button', { name: /^Import \d+ cases?$/ });

async function openCase(page: Page, caseId: string): Promise<void> {
  await page.goto(`/cases/${caseId}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Opens the decision dialog from the Actions region on the case page. */
async function openDecision(page: Page): Promise<Locator> {
  await actions(page).getByRole('button', { name: 'Record a decision', exact: true }).click();
  await expect(dialogOf(page).getByRole('heading', { name: 'Record a decision' })).toBeVisible();
  return dialogOf(page);
}

// ---------------------------------------------------------------------------------------------------------------
// (A) Decision form, as the assigned reviewer. The form is never submitted.
// ---------------------------------------------------------------------------------------------------------------
test.describe('(A) decision form as the assigned reviewer', () => {
  test('Fail shows the checklist and the submit button stays blocked until all three items are met', async ({ page }) => {
    const picked = await pickDecisionCase();
    await actAs(page, picked.reviewerId);
    await openCase(page, picked.caseId);
    const dialog = await openDecision(page);

    // All three outcome cards are offered.
    await expect(dialog.getByRole('radio', { name: /Clear the learner/ })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /Fail: violation confirmed/ })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /Inconclusive/ })).toBeVisible();

    await dialog.getByRole('radio', { name: /Fail: violation confirmed/ }).check();
    const items = checklistOf(page).getByRole('listitem');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('To do:');
    await expect(items.nth(1)).toContainText('To do:');
    await expect(items.nth(2)).toContainText('To do:');

    const confirm = dialog.getByRole('button', { name: 'Confirm violation', exact: true });
    await expect(confirm).toBeDisabled();

    // A 10-character rationale is not enough to confirm.
    await dialog.getByLabel('Rationale', { exact: true }).fill(SHORT_RATIONALE);
    await expect(confirm).toBeDisabled();
    await expect(items.nth(0)).toContainText('To do:');

    // Twenty characters or more flips the first item.
    await dialog.getByLabel('Rationale', { exact: true }).fill(LONG_RATIONALE);
    await expect(items.nth(0)).toContainText('Done:');
    await expect(confirm).toBeDisabled();

    // Citing an incriminating evidence item flips the second.
    await dialog.getByRole('checkbox', { name: new RegExp(esc(picked.incriminating.description)) }).check();
    await expect(items.nth(1)).toContainText('Done:');
    await expect(confirm).toBeDisabled();

    // The confirmation checkbox flips the third and enables the button. The button is not clicked.
    await dialog.getByRole('checkbox', { name: /You confirm you reviewed the cited evidence yourself/ }).check();
    await expect(items.nth(2)).toContainText('Done:');
    await expect(confirm).toBeEnabled();
  });

  test('Clear needs only a rationale and one cited evidence item, and no checklist is shown', async ({ page }) => {
    const picked = await pickDecisionCase();
    await actAs(page, picked.reviewerId);
    await openCase(page, picked.caseId);
    const dialog = await openDecision(page);

    await dialog.getByRole('radio', { name: /Clear the learner/ }).check();
    await expect(checklistOf(page)).toHaveCount(0);

    const clear = dialog.getByRole('button', { name: 'Clear learner', exact: true });
    await expect(clear).toBeDisabled();

    await dialog.getByRole('checkbox', { name: new RegExp(esc(picked.incriminating.description)) }).check();
    await expect(clear).toBeDisabled(); // rationale still missing

    await dialog.getByLabel('Rationale', { exact: true }).fill(CLEAR_RATIONALE);
    await expect(clear).toBeEnabled();

    // Close without submitting.
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(dialogOf(page)).toBeHidden();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// (B) Support staff: the decision is not offered, and the page says why.
// ---------------------------------------------------------------------------------------------------------------
test.describe('(B) support staff cannot record a decision', () => {
  test('Record a decision is not offered and a reason is shown', async ({ page }) => {
    const picked = await pickDecisionCase();
    await actAs(page, SUPPORT);
    await openCase(page, picked.caseId);

    await expect(actions(page).getByRole('button', { name: 'Record a decision', exact: true })).toHaveCount(0);

    // The journey rail names who must act, and the Not available list gives the server's reason.
    await expect(page.getByRole('region', { name: 'Case progress' }).getByText('Needs the assigned reviewer.')).toBeVisible();
    await actions(page).getByText(/^Not available \(\d+\)$/).click();
    await expect(actions(page).getByText('Record a decision', { exact: true })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// (C) Test Lab as the administrator: prompt, packs, run, filters, session persistence, parse errors.
// ---------------------------------------------------------------------------------------------------------------
test.describe('(C) Test Lab as Vik', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: LAB_ORIGIN });
    await actAs(page, ADMIN);
    await page.goto('/lab');
    await expect(page.getByRole('heading', { name: 'Test Lab' })).toBeVisible();
  });

  test('Copy prompt shows Copied feedback', async ({ page }) => {
    await page.getByRole('button', { name: 'Copy prompt', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  });

  test('the pack picker lists the example packs', async ({ page }) => {
    for (const title of ['Starter mix', 'Threshold boundaries', 'Workflow demo (import me)', 'Everything']) {
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
  });

  test('Load and run on Threshold boundaries shows a summary, zero failures and explained rows', async ({ page }) => {
    await packCard(page, 'Threshold boundaries').getByRole('button', { name: 'Load and run', exact: true }).click();

    await expect(summaryLine(page)).toContainText(/\d+ cases · \d+ passed, 0 failed/);
    await expect(page.getByText('Total cases')).toBeVisible();

    // Open the first collapsed row: the engine's steps appear.
    await page.getByRole('button', { expanded: false }).first().click();
    await expect(page.getByRole('heading', { name: 'How the engine decided' }).first()).toBeVisible();
  });

  test('filter chips All, Failed and Passed narrow the rows', async ({ page }) => {
    await packCard(page, 'Threshold boundaries').getByRole('button', { name: 'Load and run', exact: true }).click();
    await expect(summaryLine(page)).toBeVisible();

    const group = page.getByRole('group', { name: 'Filter cases' });
    const passedChip = group.getByRole('button', { name: /^Passed/ });
    const passedCount = Number((await passedChip.textContent())?.replace(/\D/g, ''));

    await group.getByRole('button', { name: /^Failed/ }).click();
    await expect(group.getByRole('button', { name: /^Failed/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('No cases match this filter.')).toBeVisible();

    await passedChip.click();
    await expect(passedChip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { expanded: false })).toHaveCount(passedCount);

    await group.getByRole('button', { name: /^All/ }).click();
    await expect(group.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('pasted cases and results survive navigation, and Clear session empties them', async ({ page }) => {
    await packCard(page, 'Threshold boundaries').getByRole('button', { name: 'Load and run', exact: true }).click();
    await expect(summaryLine(page)).toBeVisible();

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Cases', exact: true }).click();
    await expect(page).toHaveURL(/\/cases/);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Test Lab', exact: true }).click();
    await expect(page).toHaveURL(/\/lab/);

    await expect(labInput(page)).not.toHaveValue('');
    await expect(summaryLine(page)).toBeVisible();

    await page.getByRole('button', { name: 'Clear session', exact: true }).click();
    await expect(labInput(page)).toHaveValue('');
    await expect(summaryLine(page)).toHaveCount(0);
  });

  test('invalid JSON shows an inline error', async ({ page }) => {
    await labInput(page).fill('{"cases": [ not json');
    await page.getByRole('button', { name: 'Run through the engine', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Not valid JSON/ })).toBeVisible();
  });

  test('JSON wrapped in json code fences runs', async ({ page }) => {
    // Take the editor text from a loaded pack, then wrap it in a fenced block the way an AI would reply.
    await packCard(page, 'Threshold boundaries').getByRole('button', { name: 'Load', exact: true }).click();
    const json = await labInput(page).inputValue();
    await labInput(page).fill('```json\n' + json + '\n```');
    await page.getByRole('button', { name: 'Run through the engine', exact: true }).click();
    await expect(summaryLine(page)).toContainText(/\d+ cases/);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// (D) Import panel. Import itself is never clicked.
// ---------------------------------------------------------------------------------------------------------------
test.describe('(D) import panel access', () => {
  test('as Vik the import button is enabled after a run', async ({ page }) => {
    await actAs(page, ADMIN);
    await page.goto('/lab');
    await packCard(page, 'Threshold boundaries').getByRole('button', { name: 'Load and run', exact: true }).click();
    await expect(summaryLine(page)).toBeVisible();
    await expect(importButton(page)).toBeEnabled();
  });

  test('as Sam the import button is disabled with the reason, and the switch button changes the person', async ({ page }) => {
    await actAs(page, SUPPORT);
    await page.goto('/lab');
    await packCard(page, 'Threshold boundaries').getByRole('button', { name: 'Load and run', exact: true }).click();
    await expect(summaryLine(page)).toBeVisible();

    await expect(importButton(page)).toBeDisabled();
    await expect(page.getByText(/Only an academic administrator can import cases/)).toBeVisible();

    await page.getByRole('button', { name: /^Switch to Vik Silva/ }).first().click();
    await expect(page.getByText(/You are acting as Sam Gupta/)).toHaveCount(0);
    await expect(importButton(page)).toBeEnabled();
  });
});
