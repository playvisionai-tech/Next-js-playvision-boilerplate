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

/**
 * The count as the page shows it, scoped to the document's main landmark.
 *
 * The scope is what makes this locator single-valued. React streams a Suspense
 * boundary's resolved content into a `<div hidden>` appended to `<body>` and
 * only moves it into the boundary a frame later — or, once another boundary has
 * already revealed, up to 300ms later, because reveals are throttled. A client
 * re-render inside that window replaces the boundary in place and leaves the
 * staged copy behind until the move runs, so an unscoped `getByTestId` matches
 * both and trips strict mode. The queue flushes on mount and revalidates the
 * page, which lands inside that window on a slow dev server. The staged copy is
 * `hidden`, so it is in neither the rendered page nor the accessibility tree —
 * asserting against `main` asserts what the user can actually see.
 *
 * @param page The page holding the counter.
 * @returns A locator for the single rendered count.
 */
const currentCount = (page: Page) => page.getByRole('main').getByTestId('current-count');

test.describe('Offline', () => {
  test('queues an increment made while offline instead of losing it', async ({ page, context }) => {
    await isolate(page);
    await openCounter(page);
    await expect(currentCount(page)).toHaveText('Count: 0');

    await context.setOffline(true);

    await page.getByLabel('Increment by').fill('2');
    await page.getByRole('button', { name: 'Increment' }).click();

    await expect(page.getByTestId('pending-increments')).toBeVisible();
    // The write is queued, not applied: the count must not have moved.
    await expect(currentCount(page)).toHaveText('Count: 0');

    await context.setOffline(false);
  });

  test('flushes the queue with the exact value when connectivity returns', async ({
    page,
    context,
  }) => {
    await isolate(page);
    await openCounter(page);
    await expect(currentCount(page)).toHaveText('Count: 0');

    await context.setOffline(true);
    await page.getByLabel('Increment by').fill('3');
    await page.getByRole('button', { name: 'Increment' }).click();
    await expect(page.getByTestId('pending-increments')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByTestId('pending-increments')).toBeHidden({ timeout: 20_000 });

    await page.waitForLoadState('networkidle');
    await page.reload();
    // Exactly 3 — not "different from before". A duplicate flush would read 6.
    await expect(currentCount(page)).toHaveText('Count: 3');
  });

  test('drains a queue that survived a reload', async ({ page, context }) => {
    await isolate(page);
    await openCounter(page);
    await expect(currentCount(page)).toHaveText('Count: 0');

    await context.setOffline(true);
    await page.getByLabel('Increment by').fill('2');
    await page.getByRole('button', { name: 'Increment' }).click();
    await expect(page.getByTestId('pending-increments')).toBeVisible();

    // Back online, but no `online` event fires for a page that starts online —
    // so this only passes if the queue flushes on mount.
    await context.setOffline(false);
    await page.reload();

    await expect(page.getByTestId('pending-increments')).toBeHidden({ timeout: 20_000 });
    await expect(currentCount(page)).toHaveText('Count: 2');
  });
});
