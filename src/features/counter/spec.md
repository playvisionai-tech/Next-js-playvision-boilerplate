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
  displayed count re-renders on the server. There is no client-side refetch.
- The count streams inside `Suspense`, so the form is interactive before the
  database has answered.

## Entry points

- Route: `src/app/[locale]/(marketing)/counter/page.tsx` → `counter-view.tsx`
- Server: `server/queries.ts` (read), `server/mutations.ts` (write)
- Shared: `schema.ts` — the only module both sides import

## Where the data lives

Server database, `counter` table (`src/lib/db/schema.ts`). Nothing is persisted
in the browser; a reload re-reads from the server.

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
