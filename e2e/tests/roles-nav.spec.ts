// Roles, navigation and orientation copy. Read-only: no forms are submitted and nothing is imported.
// Changing the acting person only writes the browser's localStorage, never the server.
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { actAs } from './helpers';

/** Seeded personas, mirrored from frontend/src/lib/personas.ts (role labels from frontend/src/labels.ts). */
const PERSONA = {
  admin: { id: 'REV-000001', first: 'Vik', name: 'Vik Silva', role: 'Administrator' },
  support: { id: 'REV-000007', first: 'Sam', name: 'Sam Gupta', role: 'Support staff' },
  instructor: { id: 'REV-000018', first: 'Ben', name: 'Ben Novak', role: 'Instructor' },
  reviewer: { id: 'REV-000048', first: 'Tara', name: 'Tara Abara', role: 'Academic reviewer' },
  learner: { id: 'LRN-001502', first: 'Ivan', name: 'Ivan Lopez', role: 'Learner' },
} as const;

/** The sidebar is the only complementary landmark (the <aside>). */
function sidebar(page: Page): Locator {
  return page.getByRole('complementary');
}

/** Quick-switch persona button in the sidebar; its accessible name starts with the first name. */
function quickSwitch(page: Page, firstName: string): Locator {
  return page.getByRole('group', { name: 'Quick switch' }).getByRole('button', { name: new RegExp(`^${firstName}\\b`) });
}

/** Asserts the sidebar card shows this person's name, id and role chip. */
async function expectCurrentPerson(page: Page, p: { id: string; name: string; role: string }): Promise<void> {
  const aside = sidebar(page);
  await expect(aside.getByText(p.name, { exact: true })).toBeVisible();
  await expect(aside.getByText(p.id, { exact: true })).toBeVisible();
  // The id's parent block holds the name and the role chip together.
  const block = aside.getByText(p.id, { exact: true }).locator('xpath=..');
  await expect(block.getByText(p.role, { exact: true })).toBeVisible();
}

/** Finds an instructor or reviewer with no work that needs them right now, or null when there is none. */
async function findIdleReviewer(request: APIRequestContext): Promise<string | null> {
  const reviewers = (await (await request.get('/api/reviewers', { headers: { 'X-Actor-Id': PERSONA.admin.id } })).json()) as {
    reviewer_id: string;
    role: string;
  }[];
  for (const r of reviewers.filter((x) => x.role === 'instructor' || x.role === 'academic_reviewer')) {
    const res = await request.get('/api/queue', {
      params: { needs_my_action: 'true', limit: '1' },
      headers: { 'X-Actor-Id': r.reviewer_id },
    });
    const body = (await res.json()) as { total: number };
    if (body.total === 0) return r.reviewer_id;
  }
  return null;
}

// (1) Brand, platform strip and the "How it works" link.
test('brand shows the hackathon name and the top strip explains the platform', async ({ page }) => {
  await actAs(page, PERSONA.admin.id);
  await page.goto('/');
  await expect(sidebar(page).getByText('YottaFlex Hackathon', { exact: true })).toBeVisible();
  await expect(page.getByText(/Turns similarity-checker flags into fair, traceable academic-integrity cases/)).toBeVisible();

  const howItWorks = page.getByRole('link', { name: 'How it works', exact: true });
  await expect(howItWorks).toHaveAttribute('href', '/guide');
  await howItWorks.click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole('heading', { name: 'How review works' })).toBeVisible();
});

// (2) The sidebar stays put while the content column scrolls.
test('desktop: sidebar stays fixed while the content column scrolls on /audit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await actAs(page, PERSONA.admin.id);
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Audit', exact: true })).toBeVisible();

  const aside = sidebar(page);
  const switchButton = aside.getByRole('button', { name: 'Switch person' });
  await expect(switchButton).toBeVisible();

  // The column that scrolls is the parent of <main>; the sidebar sits beside it, outside that column.
  const scroller = page.getByRole('main').locator('xpath=..');
  await expect.poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);

  const asideBefore = await aside.boundingBox();
  const buttonBefore = await switchButton.boundingBox();
  expect(asideBefore, 'sidebar has a box before scrolling').not.toBeNull();

  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  const asideAfter = await aside.boundingBox();
  const buttonAfter = await switchButton.boundingBox();
  expect(asideAfter?.y, 'sidebar top does not move').toBe(asideBefore?.y);
  expect(buttonAfter?.y, '"Switch person" button does not move').toBe(buttonBefore?.y);
  expect(asideAfter!.y + asideAfter!.height, 'sidebar stays inside the viewport').toBeLessThanOrEqual(900 + 1);
});

// (3) Each persona quick-switch changes the current-person card and the role chip.
for (const key of ['admin', 'support', 'instructor', 'reviewer', 'learner'] as const) {
  const p = PERSONA[key];
  test(`quick switch to ${p.first} (${p.id}) updates the current-person card`, async ({ page }) => {
    // Start from a different person so the switch is a real change.
    await actAs(page, key === 'reviewer' ? PERSONA.admin.id : PERSONA.reviewer.id);
    await page.goto('/');
    await expect(sidebar(page).getByText(p.id, { exact: true })).not.toBeVisible();

    const persona = quickSwitch(page, p.first);
    await expect(persona).toBeVisible();
    await persona.click();

    await expect(persona).toHaveAttribute('aria-pressed', 'true');
    await expectCurrentPerson(page, p);
  });
}

// (4) "Switch person" dialog: search by name, ids visible, Enter picks the first match, Esc closes.
test('Switch person dialog: name search shows ids and Enter picks the first match', async ({ page }) => {
  await actAs(page, PERSONA.admin.id);
  await page.goto('/');
  await sidebar(page).getByRole('button', { name: 'Switch person' }).click();

  const dialog = page.getByRole('dialog', { name: 'Switch person' });
  await expect(dialog).toBeVisible();
  const search = dialog.getByRole('searchbox', { name: 'Search staff' });
  await expect(search).toBeFocused();

  await search.fill(PERSONA.reviewer.name);
  await expect(dialog.getByRole('list', { name: 'Staff' }).getByText(PERSONA.reviewer.id, { exact: true })).toBeVisible();

  await search.press('Enter');
  await expect(dialog).toBeHidden();
  await expectCurrentPerson(page, PERSONA.reviewer);
});

test('Switch person dialog: Escape closes without changing the person', async ({ page }) => {
  await actAs(page, PERSONA.admin.id);
  await page.goto('/');
  await sidebar(page).getByRole('button', { name: 'Switch person' }).click();

  const dialog = page.getByRole('dialog', { name: 'Switch person' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expectCurrentPerson(page, PERSONA.admin);
});

// (5) Cases page: the view tabs, ?tab= state across reload, and the dismissed-flags explanation.
const CASE_TABS = [/^Needs you/, /^Unassigned/, /^Under review/, /^All cases/, /^Awaiting appeal/, /^Decided/, /^Closed/, /^Dismissed flags/];

test('Cases page shows every view tab', async ({ page }) => {
  await actAs(page, PERSONA.admin.id);
  await page.goto('/cases');
  const tablist = page.getByRole('tablist', { name: 'Case views' });
  await expect(tablist).toBeVisible();
  for (const label of CASE_TABS) {
    await expect(tablist.getByRole('tab', { name: label })).toBeVisible();
  }
});

test('Cases tab selection survives a reload via ?tab=', async ({ page }) => {
  await actAs(page, PERSONA.admin.id);
  await page.goto('/cases?tab=under_review');
  await expect(page.getByRole('tab', { name: /^Under review/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('A reviewer is assigned and weighing the evidence.')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/tab=under_review/);
  await expect(page.getByRole('tab', { name: /^Under review/ })).toHaveAttribute('aria-selected', 'true');
});

test('Dismissed flags tab explains automatic dismissal', async ({ page }) => {
  await actAs(page, PERSONA.admin.id);
  await page.goto('/cases?tab=dismissed');
  await expect(page.getByRole('tab', { name: /^Dismissed flags/ })).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByText(
      'Automatically dismissed because quoted or template text explains the overlap. No case is opened and nothing is recorded against the learner.',
    ),
  ).toBeVisible();
});

// (6) Reviewer and instructor work lists, and the explicit empty state.
test('a reviewer sees the Your work card with assigned cases or the empty message', async ({ page }) => {
  await actAs(page, PERSONA.reviewer.id);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your work' })).toBeVisible();
  // Tara either has cases grouped by status (each with a "Next:" step) or the explicit empty message.
  await expect(
    page
      .getByText('Next:', { exact: true })
      .first()
      .or(page.getByText('Nothing is assigned to you yet. Reviewers only see cases an administrator assigns to them.')),
  ).toBeVisible();
});

test('a reviewer or instructor with no work sees the empty message and the switch-to-admin button', async ({ page, request }) => {
  const idle = await findIdleReviewer(request);
  test.skip(idle === null, 'every instructor and reviewer currently has work that needs them, so no empty state can be shown');

  await actAs(page, idle!);
  await page.goto('/');
  await expect(page.getByText('Nothing is assigned to you yet. Reviewers only see cases an administrator assigns to them.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Switch to an administrator \(Vik Silva\)/ })).toBeVisible();
});

// (7) Learner role: restricted pages, hidden links and own cases only.
test('learner: Audit and Test Lab show the not-available card and are hidden from the sidebar', async ({ page }) => {
  await actAs(page, PERSONA.learner.id);
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Not available for your role' })).toBeVisible();
  await expect(page.getByText(/Audit is open to:/)).toBeVisible();

  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Not available for your role' })).toBeVisible();
  await expect(page.getByText(/Test Lab is open to:/)).toBeVisible();

  const aside = sidebar(page);
  await expect(aside.getByRole('link', { name: 'Cases', exact: true })).toBeVisible();
  await expect(aside.getByRole('link', { name: 'Audit', exact: true })).toHaveCount(0);
  await expect(aside.getByRole('link', { name: 'Test Lab', exact: true })).toHaveCount(0);
});

test('learner: Cases lists only their own cases', async ({ page }) => {
  await actAs(page, PERSONA.learner.id);
  await page.goto('/cases?tab=all');
  await expect(page.getByText('Learners see only their own cases.')).toBeVisible();

  const caseRows = page
    .getByRole('table')
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: /^CAS-/ }) });
  // The seeded learner has at least one case (see personas.ts); if this fails the seed has changed.
  await expect(caseRows.first()).toBeVisible();
  for (const row of await caseRows.all()) {
    await expect(row).toContainText(PERSONA.learner.name);
  }
});

// (8) Guide, Rules and Overview copy and structure.
test('Guide page shows the stepper, the who-can-do-what table and the glossary', async ({ page }) => {
  await actAs(page, PERSONA.admin.id);
  await page.goto('/guide');
  await expect(page.getByRole('heading', { name: 'The whole process, step by step' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flag raised' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Case closed' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Who can do what' })).toBeVisible();
  await expect(page.getByRole('table').getByRole('columnheader', { name: 'Action', exact: true })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Glossary' })).toBeVisible();
  await expect(page.getByText('Adjusted score', { exact: true })).toBeVisible();
});

test('Rules page shows the threshold ladder', async ({ page }) => {
  await actAs(page, PERSONA.admin.id);
  await page.goto('/rules');
  await expect(page.getByRole('heading', { name: 'How a score becomes a band' })).toBeVisible();
  await expect(page.getByText(/^Below .+: no action$/)).toBeVisible();
  await expect(page.getByText(/ and above: priority review$/)).toBeVisible();
});

test('Overview shows KPI cards, dataset volume against the brief targets and the workflow card', async ({ page }) => {
  await actAs(page, PERSONA.admin.id);
  await page.goto('/');
  const main = page.getByRole('main');
  for (const label of [/Needs you/, /Under review/, /Awaiting appeal/, /Decided/, /Closed/, /Dismissed flags/]) {
    await expect(main.getByRole('link', { name: label }).first()).toBeVisible();
  }

  await expect(main.getByRole('heading', { name: 'Dataset volume' })).toBeVisible();
  // Each row reads "actual / target". The target is printed without a thousands separator in the current build, so both forms match.
  await expect(main.getByText('submission', { exact: true }).locator('xpath=..')).toContainText(/\/\s*10,?000/);
  await expect(main.getByText('flags', { exact: true }).locator('xpath=..')).toContainText(/\/\s*1,?000\b/);
  await expect(main.getByText('integrity case', { exact: true }).locator('xpath=..')).toContainText(/\/\s*300\b/);

  await expect(main.getByRole('heading', { name: 'Try the workflow' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Switch to Vik' })).toBeVisible();
});
