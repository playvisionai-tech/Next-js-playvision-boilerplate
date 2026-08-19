import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Offline has two halves that fail independently: the data (queued in
 * IndexedDB) and the app itself (precached by the service worker). These cover
 * the data half — the half that loses user input when it breaks.
 *
 * Assertions are exact counts on purpose. `after !== before` passes for the
 * right answer, the wrong answer, and a double-applied increment, so it cannot
 * tell a working queue from a duplicating one.
 *
 * The rejected-write path is not covered here: the form blocks an out-of-range
 * value, so it is only reachable when the server's rules differ from the
 * client's. Reproducing that end to end means seeding IndexedDB behind Dexie's
 * open connection, which is flaky. It is covered deterministically in
 * src/features/counter/local/__tests__/queue.test.ts instead.
 */
/**
 * Gives a test its own counter row so concurrent runs do not collide.
 *
 * @param page The page whose requests should carry the isolation header.
 * @returns Resolves once the header is set.
 */
const isolate = async (page: Page) => {
  await page.setExtraHTTPHeaders({
    'x-e2e-random-id': faker.number.int({ max: 1_000_000 }).toString(),
  });
};

/**
 * Opens the counter and waits for it to be interactive.
 *
 * The form is server-rendered before React hydrates, so a fill and click can
 * land on markup that has no handlers attached yet and silently do nothing.
 * Waiting for the network to settle is what makes these tests deterministic
 * against a cold dev server.
 *
 * @param page The page to open the counter on.
 * @returns Resolves once the page is hydrated.
 */
const openCounter = async (page: Page) => {
  await page.goto('/counter');
  await page.waitForLoadState('networkidle');
};

test.describe('Offline', () => {
  test('queues an increment made while offline instead of losing it', async ({ page, context }) => {
    await isolate(page);
    await openCounter(page);
    await expect(page.getByTestId('current-count')).toHaveText('Count: 0');

    await context.setOffline(true);

    await page.getByLabel('Increment by').fill('2');
    await page.getByRole('button', { name: 'Increment' }).click();

    await expect(page.getByTestId('pending-increments')).toBeVisible();
    // The write is queued, not applied: the count must not have moved.
    await expect(page.getByTestId('current-count')).toHaveText('Count: 0');

    await context.setOffline(false);
  });

  test('flushes the queue with the exact value when connectivity returns', async ({
    page,
    context,
  }) => {
    await isolate(page);
    await openCounter(page);
    await expect(page.getByTestId('current-count')).toHaveText('Count: 0');

    await context.setOffline(true);
    await page.getByLabel('Increment by').fill('3');
    await page.getByRole('button', { name: 'Increment' }).click();
    await expect(page.getByTestId('pending-increments')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByTestId('pending-increments')).toBeHidden({ timeout: 20_000 });

    await page.waitForLoadState('networkidle');
    await page.reload();
    // Exactly 3 — not "different from before". A duplicate flush would read 6.
    await expect(page.getByTestId('current-count')).toHaveText('Count: 3');
  });

  test('drains a queue that survived a reload', async ({ page, context }) => {
    await isolate(page);
    await openCounter(page);
    await expect(page.getByTestId('current-count')).toHaveText('Count: 0');

    await context.setOffline(true);
    await page.getByLabel('Increment by').fill('2');
    await page.getByRole('button', { name: 'Increment' }).click();
    await expect(page.getByTestId('pending-increments')).toBeVisible();

    // Back online, but no `online` event fires for a page that starts online —
    // so this only passes if the queue flushes on mount.
    await context.setOffline(false);
    await page.reload();

    await expect(page.getByTestId('pending-increments')).toBeHidden({ timeout: 20_000 });
    await expect(page.getByTestId('current-count')).toHaveText('Count: 2');
  });
});
