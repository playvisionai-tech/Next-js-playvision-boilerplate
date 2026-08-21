import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { EmptyState } from '../empty-state';

describe('Empty state', () => {
  it('renders the title alone when nothing else is given', async () => {
    await render(<EmptyState title="Nothing here yet" />);

    await expect.element(page.getByText('Nothing here yet')).toBeVisible();
  });

  it('renders the description and action when given', async () => {
    await render(
      <EmptyState
        action={<button type="button">Back to home</button>}
        description="There is nothing to show."
        title="Nothing here yet"
      />,
    );

    await expect.element(page.getByText('There is nothing to show.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Back to home' })).toBeVisible();
  });
});
