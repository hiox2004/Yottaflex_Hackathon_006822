import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { actAs } from './helpers';

const ACTOR = 'REV-000011';
const ROUTES: Record<string, string> = {
  '/': 'index',
  '/cases': 'cases',
  '/lab': 'lab',
  '/audit': 'audit',
  '/rules': 'rules',
};

const SCREENS_DIR = join(__dirname, '..', 'results', 'screens');

for (const [route, name] of Object.entries(ROUTES)) {
  test(`screenshot ${route} as ${ACTOR}`, async ({ page }) => {
    mkdirSync(SCREENS_DIR, { recursive: true });
    await actAs(page, ACTOR);
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: join(SCREENS_DIR, `${name}.png`), fullPage: true });
  });
}
