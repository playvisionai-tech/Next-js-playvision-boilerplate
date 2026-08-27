# lib/store — current behavior

## What this module does

Holds one helper, `createSelectors`, which attaches a `use` namespace of
per-field hooks to a zustand store.

## Nothing uses it yet

**There is no store in this repository.** `createSelectors` has no caller in
shipped code — its only callers are its own two test files. It was added ahead
of the first store, deliberately, so that the first store is written with the
convention already in place rather than establishing a different one and being
migrated later.

That means `zustand` is declared in `package.json` and imported by nothing that
ships. `decisions.md` records why it is in `dependencies` rather than
`devDependencies` anyway, and what no longer holds the day a store exists.

Two consequences to be honest about:

- `pnpm check:deps` passes only because the tests import the helper. Delete
  them and knip reports the file and the package as unused, in that order.
- The helper carries no production evidence. It is covered by tests against a
  real store, including a rendered one, but nothing has yet used it in anger.

## Behavior

- `createSelectors(store)` returns **the same store object**, with a `use`
  property added. It does not copy. A bound store is a callable object other
  modules may already hold, and returning a second object would leave two ways
  to read one store.
- `use` gets one hook per key of `store.getState()` **at the moment
  `createSelectors` is called** — that is, the store's initial state. A field
  that first appears in a later `setState` has no hook, and the type does not
  admit one either.
- Each hook subscribes to its own field: `store.use.label()` re-renders its
  component when `label` changes and not when anything else does. That
  narrowing is the entire reason the helper exists.
- The hooks are typed from what `getState` returns, so `store.use.coutn()` is a
  compile error rather than a hook that returns `undefined` forever.
- A field declared optional and left out of the initial state gets no hook, and
  the type keeps its `?`. TypeScript refuses the call instead of promising a
  hook that was never built.

## The store it is waiting for

```ts
'use client';

import { create } from 'zustand';
import { createSelectors } from '@/lib/store/selectors';

type Filters = { query: string; setQuery: (query: string) => void };

export const useFilters = createSelectors(
  create<Filters>()((set) => ({
    query: '',
    setQuery: (query) => {
      set({ query });
    },
  })),
);
```

Read at a call site as `useFilters.use.query()`.

## Where a store belongs, and where it does not

**In the slice that owns it**, not here. `lib/store` is the convention; a store
is state, and state belongs to the feature whose state it is. One feature's
store is `src/features/<f>/store.ts`; this directory only grows a store of its
own if two features genuinely share one.

It is **not** the `local/` tier. That tier is for browser-*persisted* data and
starts with `import 'client-only'`. A zustand store here is memory: it does not
survive a reload, which under the storage-tier rule in `AGENTS.md` puts it in
the same bracket as React state, not in browser storage.

**A store module needs `'use client'`.** `createSelectors` itself has no
directive — it is a plain function, and adding one would push the boundary
further up than it needs to go. The module that calls `create` is the one that
must carry it: a store created at module scope in server code is a per-process
singleton shared by every request that process handles, which is one user's
state answering another's. `src/lib/api/spec.md` records the same hazard for
the query cache, and it is the same hazard.

## Out of scope

Persistence, devtools, and middleware. Each is a zustand feature this repo has
taken no position on, and taking one before a store exists would be guessing.
The `persist` middleware in particular is a storage-tier decision under
`AGENTS.md`, not a configuration detail — it writes to `localStorage`, which is
per-origin and shared by everyone at that machine.

## Access

None. The helper reads nothing and reaches nothing; it attaches functions to an
object it was handed.
