import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';

/**
 * Offline behaviour has two halves that fail independently: the data (queued
 * in IndexedDB) and the app itself (cached by the service worker). These test
 * the first, which is the half that loses user input when it breaks.
 */
test.describe('Offline', () => {
  test('queues an increment made while offline instead of losing it', async ({ page, context }) => {
    const e2eRandomId = faker.number.int({ max: 1_000_000 });
    await page.setExtraHTTPHeaders({ 'x-e2e-random-id': e2eRandomId.toString() });

    await page.goto('/counter');
    await expect(page.getByTestId('current-count')).toBeVisible();

    await context.setOffline(true);

    await page.getByLabel('Increment by').fill('2');
    await page.getByRole('button', { name: 'Increment' }).click();

    // The write is not lost: it is visibly waiting.
    await expect(page.getByTestId('pending-increments')).toBeVisible();

    await context.setOffline(false);
  });

  test('flushes the queue when connectivity returns', async ({ page, context }) => {
    const e2eRandomId = faker.number.int({ max: 1_000_000 });
    await page.setExtraHTTPHeaders({ 'x-e2e-random-id': e2eRandomId.toString() });

    await page.goto('/counter');
    const before = await page.getByTestId('current-count').textContent();

    await context.setOffline(true);
    await page.getByLabel('Increment by').fill('3');
    await page.getByRole('button', { name: 'Increment' }).click();
    await expect(page.getByTestId('pending-increments')).toBeVisible();

    await context.setOffline(false);

    // The queue drains on the online event, and the pending marker disappears.
    await expect(page.getByTestId('pending-increments')).toBeHidden({ timeout: 20_000 });

    await page.reload();
    const after = await page.getByTestId('current-count').textContent();

    expect(after).not.toBe(before);
  });
});
