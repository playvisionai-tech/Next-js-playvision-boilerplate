import { describe, expect, it } from 'vitest';
import { create } from 'zustand';
import { createSelectors } from '../selectors';

type Counter = {
  count: number;
  label: string;
  increment: () => void;
  /** Declared, but deliberately absent from the initial state. */
  note?: string;
};

/**
 * Builds a real bound store, so what is under test is the helper rather than a
 * stand-in that agrees with it.
 *
 * @returns A fresh counter store, not shared with any other test.
 */
const counterStore = () =>
  create<Counter>()((set) => ({
    count: 0,
    label: 'zero',
    increment: () => {
      set((state) => ({ count: state.count + 1 }));
    },
  }));

describe('Store selectors', () => {
  it('hands back the same store, so an existing reference keeps working', () => {
    const store = counterStore();

    expect(createSelectors(store)).toBe(store);
  });

  it('exposes one hook per field of the initial state and nothing else', () => {
    const store = createSelectors(counterStore());

    expect(Object.keys(store.use)).toStrictEqual(['count', 'label', 'increment']);
  });

  it('leaves the store API it wraps untouched', () => {
    const store = createSelectors(counterStore());

    store.getState().increment();

    expect(store.getState().count).toBe(1);
  });

  // The `use` namespace is built from a snapshot of the initial state, which is
  // the shape zustand's own recipe has. A field that only appears after a later
  // `setState` therefore has no hook. The mapped type is homomorphic, so an
  // optional field keeps its `?` and TypeScript refuses to call it — the type
  // and the runtime agree rather than the type promising more.
  it('gives no hook to a field the initial state did not include', () => {
    const store = createSelectors(counterStore());

    store.setState({ note: 'late' });

    expect(store.getState().note).toBe('late');
    expect(store.use).not.toHaveProperty('note');
    expect(store.use.note).toBeUndefined();
  });
});
