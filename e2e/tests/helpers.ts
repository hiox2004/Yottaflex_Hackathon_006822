import type { Page } from '@playwright/test';

/** localStorage key the frontend reads for the signed-in reviewer (frontend/src/api/actor.ts). */
export const ACTOR_KEY = 'integrity.actorId';

/**
 * Sets the acting reviewer before any navigation. The init script runs on every
 * document load, so the value survives reloads and in-app navigation.
 */
export async function actAs(page: Page, reviewerId: string): Promise<void> {
  await page.addInitScript(
    ([key, id]) => {
      window.localStorage.setItem(key, id);
    },
    [ACTOR_KEY, reviewerId] as const,
  );
}
