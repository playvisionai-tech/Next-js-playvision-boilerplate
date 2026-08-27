import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { create } from 'zustand';
import { createSelectors } from '../selectors';

type Counter = {
  count: number;
  label: string;
};

/**
 * Builds a real bound store with selectors attached.
 *
 * @returns A fresh counter store, not shared with any other test.
 */
const counterStore = () => createSelectors(create<Counter>()(() => ({ count: 0, label: 'zero' })));

describe('Store selector hooks', () => {
  it('renders the field it selects and re-renders when that field changes', async () => {
    const store = counterStore();
    const Count = () => <span>count:{store.use.count()}</span>;

    await render(<Count />);
    await expect.element(page.getByText('count:0')).toBeVisible();

    store.setState({ count: 3 });

    await expect.element(page.getByText('count:3')).toBeVisible();
  });

  // This is the whole point of the helper. A component subscribed to the store
  // as a whole re-renders on every write; one subscribed through `use.label`
  // sees only writes to `label`.
  it('does not re-render a consumer whose own field did not change', async () => {
    const store = counterStore();
    let labelRenders = 0;

    const Label = () => {
      labelRenders += 1;
      return <span>label:{store.use.label()}</span>;
    };
    const Count = () => <span>count:{store.use.count()}</span>;

    await render(
      <div>
        <Label />
        <Count />
      </div>,
    );
    await expect.element(page.getByText('label:zero')).toBeVisible();

    const before = labelRenders;

    store.setState({ count: 7 });

    await expect.element(page.getByText('count:7')).toBeVisible();

    expect(labelRenders).toBe(before);
  });
});
