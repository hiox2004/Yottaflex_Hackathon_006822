import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Failure artifacts (traces, screenshots). Kept in a sub-folder so the
  // deliberate screenshots in results/screens survive Playwright's output clean-up.
  outputDir: './results/test-output',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
