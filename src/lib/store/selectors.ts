import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * A bound store with a `use` namespace: one hook per top-level state field.
 *
 * The mapped type is derived from what `getState` returns, so the hooks exist
 * only for fields the store actually declares. A typo in `store.use.coutn()` is
 * a compile error rather than a hook that returns `undefined` forever. It is
 * homomorphic, so an optional field keeps its `?` — which is what stops a hook
 * that was never built at runtime from being callable.
 */
type WithSelectors<TStore> = TStore extends { getState: () => infer TState }
  ? TStore & { use: { readonly [K in keyof TState]: () => TState[K] } }
  : never;

/**
 * Attaches a `use` namespace of per-field hooks to a zustand store.
 *
 * Subscribing to a whole store re-renders every consumer on every write, and
 * the fix — passing a selector at each call site — is a convention no tool
 * enforces. This turns the convention into API: `useCount()` does not exist,
 * `store.use.count()` does, and it is narrow by construction.
 *
 * The store is mutated and returned, not copied. A bound store is a callable
 * object other modules may already hold a reference to, and handing back a
 * second object would leave two ways to read one store.
 *
 * @param store The bound store returned by zustand's `create`.
 * @returns The same store, with a `use` hook for every field of its initial state.
 */
export function createSelectors<TStore extends UseBoundStore<StoreApi<object>>>(
  store: TStore,
): WithSelectors<TStore> {
  const selectors: Record<string, () => unknown> = {};

  for (const key of Object.keys(store.getState())) {
    selectors[key] = () =>
      store((state) => {
        const field: unknown = Reflect.get(state, key);

        return field;
      });
  }

  // The one unverifiable step, kept to one line: an object keyed at runtime
  // cannot be checked against a type mapped over the same state. What makes the
  // claim true is that both sides come from `getState()` — the keys below and
  // the `keyof TState` above are the same set.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Keys built from getState() cannot be proven to satisfy a type mapped over that same state.
  return Object.assign(store, { use: selectors }) as WithSelectors<TStore>;
}
