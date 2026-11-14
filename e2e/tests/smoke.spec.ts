import { expect, test, type Page } from '@playwright/test';

const ROUTES = ['/', '/cases', '/lab', '/audit', '/rules'];

/** Collects uncaught page errors and console.error messages for the page's lifetime. */
function watchErrors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { pageErrors, consoleErrors };
}

for (const route of ROUTES) {
  test(`route ${route} renders cleanly`, async ({ page }) => {
    const errors = watchErrors(page);

    await page.goto(route);
    await expect(page.getByRole('heading').first()).toBeVisible();

    const text = (await page.locator('body').innerText()).trim();
    expect(text.length, `body text on ${route}`).toBeGreaterThan(50);

    expect(errors.pageErrors, `uncaught page errors on ${route}`).toEqual([]);
    expect(errors.consoleErrors, `console errors on ${route}`).toEqual([]);
  });
}

test('cases list -> first case detail', async ({ page }) => {
  const errors = watchErrors(page);

  await page.goto('/cases');
  const firstCase = page.locator('a[href^="/cases/CAS-"]').first();
  await expect(firstCase).toBeVisible();
  await firstCase.click();

  await expect(page).toHaveURL(/\/cases\/CAS-/);
  await expect(page.getByRole('heading').first()).toBeVisible();

  expect(errors.pageErrors, 'uncaught page errors').toEqual([]);
  expect(errors.consoleErrors, 'console errors').toEqual([]);
});
