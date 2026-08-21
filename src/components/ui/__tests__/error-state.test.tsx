import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { ErrorState } from '../error-state';

describe('Error state', () => {
  it('announces itself to assistive technology', async () => {
    await render(<ErrorState title="Something went wrong" />);

    await expect.element(page.getByRole('alert')).toBeVisible();
  });

  it('hides the retry button when there is nothing to retry', async () => {
    await render(<ErrorState title="Something went wrong" />);

    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  it('calls onRetry when the retry button is pressed', async () => {
    const onRetry = vi.fn<() => void>();

    await render(
      <ErrorState onRetry={onRetry} retryLabel="Try again" title="Something went wrong" />,
    );

    await page.getByRole('button', { name: 'Try again' }).click();

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
