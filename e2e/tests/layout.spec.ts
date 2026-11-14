import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { actAs } from './helpers';

const ACTOR = 'REV-000018'; // Ben Novak (instructor)
const SCREENS_DIR = join(__dirname, '..', 'results', 'screens');
const ID_CELL = /^(CAS|EVD|APL|DEC)-/;

/** Tags the content column (overflowing, overflow-y auto, outside the sidebar) and returns a selector for it. */
async function tagScrollColumn(page: Page): Promise<string> {
  const found = await page.evaluate(() => {
    const hit = Array.from(document.querySelectorAll<HTMLElement>('body *')).find(
      (el) => getComputedStyle(el).overflowY === 'auto' && el.scrollHeight > el.clientHeight + 1 && !el.closest('aside'),
    );
    if (!hit) return false;
    hit.setAttribute('data-e2e-scroll', 'main-column');
    return true;
  });
  return found ? '[data-e2e-scroll="main-column"]' : '';
}

/** Number of distinct text lines a cell's text occupies (one entry per visual line box). */
async function textLineCount(page: Page, index: number): Promise<number> {
  return page.evaluate((i) => {
    const td = document.querySelectorAll('td')[i];
    const range = document.createRange();
    range.selectNodeContents(td);
    const tops = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top)));
    return tops.size;
  }, index);
}

test.beforeAll(() => {
  mkdirSync(SCREENS_DIR, { recursive: true });
});

test('desktop: sidebar stays fixed while the content column scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await actAs(page, ACTOR);
  await page.goto('/audit');
  await expect(page.getByRole('heading').first()).toBeVisible();

  const aside = page.locator('aside');
  const switchPerson = aside.getByRole('button', { name: 'Switch person' });
  await expect(switchPerson).toBeVisible();

  const before = await aside.boundingBox();
  const buttonBefore = await switchPerson.boundingBox();
  expect(before, 'sidebar bounding box').not.toBeNull();
  await page.screenshot({ path: join(SCREENS_DIR, 'layout-desktop-top.png') });

  const selector = await tagScrollColumn(page);
  expect(selector, 'a scrollable content column exists').not.toBe('');
  await page.locator(selector).evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const scrollTop = await page.locator(selector).evaluate((el) => el.scrollTop);
  expect(scrollTop, 'content column actually scrolled').toBeGreaterThan(0);

  const after = await aside.boundingBox();
  const buttonAfter = await switchPerson.boundingBox();
  expect(after?.y, 'sidebar y after scroll').toBe(before?.y);
  expect(buttonAfter?.y, '"Switch person" button y after scroll').toBe(buttonBefore?.y);
  expect(after!.y, 'sidebar top inside viewport').toBeGreaterThanOrEqual(0);
  expect(after!.y + after!.height, 'sidebar bottom inside viewport').toBeLessThanOrEqual(900 + 1);

  const page_ = await page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollHeight ?? 0,
    inner: window.innerHeight,
  }));
  expect(page_.scroll, 'document itself does not scroll').toBeLessThanOrEqual(page_.inner + 1);

  await page.screenshot({ path: join(SCREENS_DIR, 'layout-desktop-scrolled.png') });
});

test('findings table ids do not wrap', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await actAs(page, ACTOR);
  await page.goto('/audit?tab=findings');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.waitForLoadState('networkidle');

  const cells = page.locator('td');
  const count = await cells.count();
  const idIndexes: number[] = [];
  for (let i = 0; i < count; i++) {
    const text = ((await cells.nth(i).textContent()) ?? '').trim();
    if (ID_CELL.test(text)) idIndexes.push(i);
  }
  test.info().annotations.push({ type: 'id-cells', description: String(idIndexes.length) });
  expect(idIndexes.length, 'id cells found on the findings tab').toBeGreaterThan(0);

  const wrapped: { text: string; lines: number }[] = [];
  for (const i of idIndexes) {
    const lines = await textLineCount(page, i);
    if (lines !== 1) wrapped.push({ text: ((await cells.nth(i).textContent()) ?? '').trim(), lines });
  }
  expect(wrapped, `id cells spanning more than one line: ${JSON.stringify(wrapped.slice(0, 10))}`).toEqual([]);

  await page.screenshot({ path: join(SCREENS_DIR, 'layout-audit-findings.png'), fullPage: true });
});

test('mobile: sidebar hidden, menu button opens it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await actAs(page, ACTOR);
  await page.goto('/audit');
  await expect(page.getByRole('heading').first()).toBeVisible();

  const aside = page.locator('aside');
  await expect(aside).not.toBeInViewport();
  await page.screenshot({ path: join(SCREENS_DIR, 'layout-mobile-closed.png') });

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(aside).toBeInViewport();
  await expect(aside.getByRole('button', { name: 'Switch person' })).toBeVisible();
  await page.screenshot({ path: join(SCREENS_DIR, 'layout-mobile-open.png') });
});
