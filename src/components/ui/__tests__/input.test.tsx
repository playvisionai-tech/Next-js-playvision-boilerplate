import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { Input } from '../input';
import { Label } from '../label';

describe(Input, () => {
  it('is reachable by its label', async () => {
    await render(
      <>
        <Label htmlFor="increment">Increment by</Label>
        <Input id="increment" type="number" />
      </>,
    );

    await expect.element(page.getByLabelText('Increment by')).toBeVisible();
  });

  it('accepts typed input', async () => {
    await render(<Input aria-label="Increment by" type="number" />);

    const field = page.getByLabelText('Increment by');
    await field.fill('3');

    await expect.element(field).toHaveValue(3);
  });
});
