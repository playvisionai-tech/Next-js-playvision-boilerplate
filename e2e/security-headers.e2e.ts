import { expect, test } from '@playwright/test';

test.describe('Security headers', () => {
  test('sends the headers on a page response', async ({ page }) => {
    const response = await page.goto('/');

    expect(response).not.toBeNull();

    const headers = response?.headers() ?? {};

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['permissions-policy']).toContain('camera=()');
  });

  test('sends a content security policy that forbids framing', async ({ page }) => {
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy-report-only'];

    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");

    // The policy ships report-only, so dropping one of these breaks Firebase
    // silently: gtag never loads, or Installations never registers and both
    // Analytics and Remote Config quietly stop. Asserting them here is what
    // turns that into a loud failure. See src/lib/firebase/spec.md.
    expect(csp).toContain('https://www.googletagmanager.com');
    expect(csp).toContain('https://firebaseinstallations.googleapis.com');
    expect(csp).toContain('https://firebaseremoteconfig.googleapis.com');
    expect(csp).toContain('https://firebase.googleapis.com');
  });
});
