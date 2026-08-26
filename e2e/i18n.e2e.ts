import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@playwright/test';

test.describe('I18n', () => {
  test.describe('Language Switching', () => {
    test('should switch language from English to French using dropdown and verify text on the homepage', async ({
      page,
    }) => {
      await page.goto('/');

      await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

      await page.getByLabel('Change language').selectOption('fr');

      await expect(page.getByRole('heading', { name: 'Accueil' })).toBeVisible();
    });

    /*
     * The regression the test above cannot catch. It only fails when the
     * change event lands before React has hydrated the select — a window that
     * a developer machine closes too fast to hit, which is why the bug was
     * green locally and red in CI on the same commit. Holding back the client
     * chunks widens that window deliberately, so the race is asserted rather
     * than waited on.
     *
     * `waitUntil: 'commit'` because 'load' would wait for the very chunks
     * being delayed, and the point is to interact before they arrive.
     */
    test('should switch language when the choice is made before hydration', async ({ page }) => {
      await page.route('**/_next/static/**', async (route) => {
        await delay(2000);
        await route.continue();
      });

      await page.goto('/', { waitUntil: 'commit' });

      await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

      await page.getByLabel('Change language').selectOption('fr');

      await expect(page.getByRole('heading', { name: 'Accueil' })).toBeVisible();
    });

    /*
     * This asserts against our own translated copy rather than the hosted
     * sign-in widget it used to use. The subject is URL-driven locale
     * switching; routing it through a third party's UI meant the test failed
     * whenever that vendor's credentials were absent, which says nothing about
     * whether i18n works.
     */
    test('should switch language from English to French using the URL', async ({ page }) => {
      await page.goto('/about');

      await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();

      await page.goto('/fr/about');

      await expect(page.getByRole('heading', { name: 'A propos' })).toBeVisible();
    });
  });
});
