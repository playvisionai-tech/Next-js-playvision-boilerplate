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
- The queue drains on mount, on the browser's `online` event, after any submit
  that reaches the server, when the tab becomes visible again, and on a backoff
  timer — 2s doubling to a 30s ceiling — that runs while anything is pending.
  All of it happens under a Web Locks leader, including scheduling the timer, so
  several open tabs do not each send the same rows or each wake on their own
  clock.
- A write the server refuses (`status: 'invalid'`) is rejected immediately: the
  refusal is deterministic, so retrying it cannot help.
- A write that fails in transit is never rejected on the attempt count alone.
  Once it has failed `MAX_ATTEMPTS` times the client asks the server, via
  `wasApplied`, whether the mutation id is already recorded:
  - applied — the row is acked. The write landed and only the response was lost.
  - not applied — the row is rejected as `unreachable`.
  - the question itself fails — the row stays pending and keeps retrying, which
    is safe because the write is idempotent.
- A rejected write is shown separately with retry and discard actions. Retry
  clears the reason, resets the attempt count and flushes. Nothing is ever
  deleted silently.
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
- Server: `server/queries.ts` (reads: `getCurrentCount` for rendering,
  `wasApplied` for the queue), `server/mutations.ts` (write). `queries.ts` is
  `'use server'` because the queue has to reach `wasApplied` from the browser.
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
attempt counter, and a `rejectedReason` once the server has confirmed it failed.
The attempt counter paces retries; it does not decide them.

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
