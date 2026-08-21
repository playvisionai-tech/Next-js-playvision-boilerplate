import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Offline has two halves that fail independently: the data (queued in
 * IndexedDB) and the app itself (precached by the service worker). These cover
 * the data half — the half that loses user input when it breaks.
 *
 * The subject is the example slice, which has no route in a production build.
 * CI runs these specs against `next start`, so they are skipped there and run
 * against the dev server locally. The queue's own rules are covered
 * deterministically, on every CI run, in
 * src/lib/offline-queue/__tests__/store.test.ts.
 *
 * Each test writes a note whose body is unique, then asserts that body appears
 * EXACTLY once. A count of one is what separates a working queue from a
 * duplicating one; "the list changed" passes for both.
 *
 * The rejected-write path is not covered here: the form blocks an out-of-range
 * value, so it is only reachable when the server's rules differ from the
 * client's. Reproducing that end to end means seeding IndexedDB behind Dexie's
 * open connection, which is flaky. It is covered in the store's unit tests.
 */
test.skip(
  process.env.CI === 'true',
  'The example slice is development-only, and CI runs E2E against a production build.',
);

/**
 * Opens the example slice and waits for it to be interactive.
 *
 * The form is server-rendered before React hydrates, so a fill and click can
 * land on markup that has no handlers attached yet and silently do nothing.
 * Waiting for the network to settle is what makes these tests deterministic
 * against a cold dev server.
 *
 * @param page The page to open the example on.
 * @returns Resolves once the page is hydrated.
 */
const openExample = async (page: Page) => {
  await page.goto('/example');
  await page.waitForLoadState('networkidle');
};

/**
 * Locates a note by its body, scoped to the document's main landmark.
 *
 * The scope is what keeps this locator single-valued. React streams a Suspense
 * boundary's resolved content into a `<div hidden>` appended to `<body>` and
 * only moves it into the boundary a frame later — or, once another boundary has
 * already revealed, up to 300ms later, because reveals are throttled. A client
 * re-render inside that window replaces the boundary in place and leaves the
 * staged copy behind until the move runs, so an unscoped locator matches both
 * and reports two. The staged copy is `hidden`, so it is in neither the
 * rendered page nor the accessibility tree — asserting against `main` asserts
 * what the user can actually see.
 *
 * @param page The page holding the list.
 * @param body The note text to look for.
 * @returns A locator for the rendered note.
 */
const note = (page: Page, body: string) => page.getByRole('main').getByText(body, { exact: true });

/**
 * Types a note into the form and submits it.
 *
 * @param page The page holding the form.
 * @param body The note text to write.
 * @returns Resolves once the note has been submitted.
 */
const addNote = async (page: Page, body: string) => {
  await page.getByLabel('Note').fill(body);
  await page.getByRole('button', { name: 'Add note' }).click();
};

test.describe('Offline', () => {
  test('queues a note written while offline instead of losing it', async ({ page, context }) => {
    const body = `offline-${faker.string.uuid()}`;

    await openExample(page);
    await context.setOffline(true);
    await addNote(page, body);

    await expect(page.getByTestId('pending-notes')).toBeVisible();
    // The write is queued, not applied: it must not be in the list yet.
    await expect(note(page, body)).toHaveCount(0);

    await context.setOffline(false);
  });

  test('flushes the queue exactly once when connectivity returns', async ({ page, context }) => {
    const body = `flush-${faker.string.uuid()}`;

    await openExample(page);
    await context.setOffline(true);
    await addNote(page, body);
    await expect(page.getByTestId('pending-notes')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByTestId('pending-notes')).toBeHidden({ timeout: 20_000 });

    await page.waitForLoadState('networkidle');
    await page.reload();
    // Exactly one — a duplicate flush would render the same note twice.
    await expect(note(page, body)).toHaveCount(1);
  });

  test('drains a queue that survived a reload', async ({ page, context }) => {
    const body = `reload-${faker.string.uuid()}`;

    await openExample(page);
    await context.setOffline(true);
    await addNote(page, body);
    await expect(page.getByTestId('pending-notes')).toBeVisible();

    // Back online, but no `online` event fires for a page that starts online —
    // so this only passes if the queue flushes on mount.
    await context.setOffline(false);
    await page.reload();

    await expect(page.getByTestId('pending-notes')).toBeHidden({ timeout: 20_000 });
    await expect(note(page, body)).toHaveCount(1);
  });
});
