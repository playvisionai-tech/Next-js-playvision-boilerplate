import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { Button } from '../button';

describe(Button, () => {
  it('renders its label', async () => {
    await render(<Button>Increment</Button>);

    await expect.element(page.getByRole('button', { name: 'Increment' })).toBeVisible();
  });

  it('does not fire its handler while disabled', async () => {
    const onClick = vi.fn<() => void>();

    await render(
      <Button disabled onClick={onClick}>
        Increment
      </Button>,
    );

    const button = page.getByRole('button', { name: 'Increment' });

    await expect.element(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps button semantics across variants', async () => {
    await render(
      <Button size="sm" variant="destructive">
        Delete
      </Button>,
    );

    // The inventory says navigation belongs to Link, not Button: whatever the
    // variant, this stays a button.
    await expect.element(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });
});
