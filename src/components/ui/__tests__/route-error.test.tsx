import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import messages from '@/messages/en.json';
import { RouteError } from '../route-error';

const refresh = vi.fn<() => void>();
const noop = () => {};

vi.mock(import('@/lib/i18n/navigation'), () => ({
  useRouter: () => ({
    refresh,
    push: noop,
    replace: noop,
    prefetch: noop,
    back: noop,
    forward: noop,
  }),
}));

const renderBoundary = async (reset: () => void) =>
  await render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RouteError error={new Error('boom')} reset={reset} />
    </NextIntlClientProvider>,
  );

describe('Route error', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    refresh.mockClear();
  });

  it('announces itself to assistive technology', async () => {
    await renderBoundary(vi.fn());

    await expect.element(page.getByRole('alert')).toBeVisible();
  });

  it('refetches the server tree as well as resetting the boundary', async () => {
    const reset = vi.fn<() => void>();
    await renderBoundary(reset);

    await page.getByRole('button', { name: messages.ErrorState.retry }).click();

    expect(refresh).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });
});
