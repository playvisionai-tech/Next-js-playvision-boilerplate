import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { FLAG_DEFAULTS } from '../flag-keys';
import { FirebaseProvider, useFlag } from '../provider';

const FlagProbe = () => <span>{`flag:${String(useFlag('example_reference_flag'))}`}</span>;

describe('Firebase provider with no project configured', () => {
  it('renders its children rather than swallowing them', async () => {
    await render(
      <FirebaseProvider>
        <p>Page content</p>
      </FirebaseProvider>,
    );

    await expect.element(page.getByText('Page content')).toBeVisible();
  });

  it('serves the declared default to a consumer', async () => {
    await render(
      <FirebaseProvider>
        <FlagProbe />
      </FirebaseProvider>,
    );

    const expected = `flag:${String(FLAG_DEFAULTS.example_reference_flag)}`;

    await expect.element(page.getByText(expected)).toBeVisible();
  });

  it('serves the default outside the provider instead of throwing', async () => {
    await render(<FlagProbe />);

    const expected = `flag:${String(FLAG_DEFAULTS.example_reference_flag)}`;

    await expect.element(page.getByText(expected)).toBeVisible();
  });

  // The gate is what keeps an unconfigured checkout from talking to Google at
  // all. If it ever fails open, gtag.js appears in the document and this fails.
  it('loads no third-party script', async () => {
    await render(
      <FirebaseProvider>
        <p>Page content</p>
      </FirebaseProvider>,
    );

    await expect.element(page.getByText('Page content')).toBeVisible();

    const sources = [...document.querySelectorAll('script')].map((script) => script.src);

    expect(sources.some((source) => source.includes('googletagmanager.com'))).toBeFalsy();
  });
});
