# Counter — current behavior

## What this feature does

A demonstration slice: a form that increments a stored integer, and a display
of its current value. It exists to exercise every tier of the structure —
client form, shared schema, Server Action, server query — on something small
enough to read in one sitting.

## Behavior

- The form accepts an increment between 1 and 3 and validates it in the browser
  with `schema.ts`.
- Submitting calls the `incrementCounter` Server Action, which re-validates the
  same payload with the same schema before touching the database.
- An out-of-range value never reaches the server: the form blocks it and shows
  the range error. A payload that reaches the action anyway returns
  `{ status: 'invalid' }` and writes nothing.
- After a successful increment the action calls `revalidatePath`, so the
  displayed count re-renders on the server.
- Offline, or when the request fails, the increment is queued by
  `lib/offline-queue` and the form shows how many writes are waiting. The queue
  owns the durability, the retries and the drain; this slice owns what a queued
  row means. `use-counter-queue.ts` supplies the two things the queue cannot
  decide for itself: `send`, which calls `incrementCounter` and reports only
  `ok` or a refusal, and `wasApplied`, which answers whether an id already
  landed. See `src/lib/offline-queue/spec.md` for the delivery behavior.
- A write the server refuses (`status: 'invalid'`) is reported to the queue as a
  rejection and is not retried: the refusal is deterministic, so retrying it
  cannot help. Anything else throws, which is what tells the queue the write may
  still have landed.
- A rejected write is shown separately with retry and discard actions. Nothing
  is ever deleted silently.
- Retries are safe to repeat: every queued write carries a `mutationId`, and the
  action applies each id at most once.
- The count streams inside `Suspense`, so the form is interactive before the
  database has answered. React reveals a streamed boundary from a scheduled
  callback rather than as the markup arrives, so between the stream and the
  reveal the resolved count sits in a `hidden` staging container appended to
  `<body>`. End-to-end assertions on the count are scoped to `main` for that
  reason.

## Entry points

- Route: `src/app/[locale]/(marketing)/counter/page.tsx` → `counter-view.tsx`
- Server: `server/queries.ts` (`getCurrentCount`, for rendering),
  `server/mutation-status.ts` (`wasApplied`, `'use server'` so the queue can
  reach it from the browser), `server/mutations.ts` (write).
- Client state: `use-counter-queue.ts`, which binds `lib/offline-queue` to this
  feature's mutation and its idempotency check.
- Shared: `schema.ts` — the only module both sides import. It exports two
  schemas: the form validates the user's input, the action validates that plus
  the `mutationId`, which is not user input.

## Where the data lives

Two tiers, and the server is authoritative.

**Server database** — the `counter` table (`src/lib/db/schema.ts`) holds the
count, and `processed_mutation` holds the ids of writes already applied.

**Browser storage** — rows in the shared `pendingWrites` store in IndexedDB
(`src/lib/local-db/client.ts`), under the queue name `counter`. Each carries
`{ increment }` as its payload plus the queue's envelope. It is a queue, never a
cache of the count, and rows leave it only when the server confirms them.

Which row a request uses is decided by `server/counter-id.ts`: end-to-end runs
send an `x-e2e-random-id` header so concurrent tests increment different rows.
Without the header every request shares row 0. Reading that header is what makes
the route dynamic rather than static.

## Access

None. The counter is public and unauthenticated by design — it is a
demonstration, not a user-owned resource. A real feature owning per-user data
would re-check access in both `queries.ts` and `mutations.ts`.

## Out of scope

Decrementing, resetting, and history. The slice is deliberately minimal; adding
to it makes it worse as a reference.
