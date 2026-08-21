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
