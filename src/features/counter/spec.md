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
- Offline, or when the request fails, the increment is queued in IndexedDB and
  the form shows how many writes are waiting.
- The queue drains on mount and on the browser's `online` event, under a Web
  Locks leader so several open tabs do not each send the same rows.
- A write the server refuses, or one that has failed transiently five times, is
  marked rejected and shown separately with a discard action. It is never
  deleted silently.
- Retries are safe to repeat: every queued write carries a `mutationId`, and the
  action applies each id at most once.
- The count streams inside `Suspense`, so the form is interactive before the
  database has answered.

## Entry points

- Route: `src/app/[locale]/(marketing)/counter/page.tsx` → `counter-view.tsx`
- Server: `server/queries.ts` (read), `server/mutations.ts` (write)
- Client state: `use-offline-queue.ts`; queue access in `local/queue.ts`
- Shared: `schema.ts` — the only module both sides import. It exports two
  schemas: the form validates the user's input, the action validates that plus
  the `mutationId`, which is not user input.

## Where the data lives

Two tiers, and the server is authoritative.

**Server database** — the `counter` table (`src/lib/db/schema.ts`) holds the
count, and `processed_mutation` holds the ids of writes already applied.

**Browser storage** — `pendingIncrements` in IndexedDB
(`src/lib/local-db/client.ts`) holds increments that have not reached the
server yet: made offline, or attempted and failed. It is a queue, never a cache
of the count. A row carries the increment, a client-generated `mutationId`, an
attempt counter, and a `rejectedReason` once it has failed permanently.

Rows leave the queue only when the server confirms them. A row is offered for
sending until then, so closing the tab mid-flush loses nothing.

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
