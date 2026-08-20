# Counter — decisions

## 2026-08-18 — Server Action over a route handler

**Chose:** a `'use server'` mutation in `server/mutations.ts`, called directly
from the client form.
**Over:** the `PUT /api/counter` route handler this feature originally shipped
with, called via `fetch` and followed by `router.refresh()`.
**Why:** the route existed only so our own client could reach our own database.
That is an HTTP round trip from the process to itself, and it forced the
revalidation strategy into the component (`router.refresh()` refetches
everything, not just what changed). The action calls `revalidatePath` and names
what it invalidates.
**Trade-off:** the mutation is no longer callable over HTTP, so it cannot be
tested with a request-level integration test. The form is covered end to end
instead, which is closer to what a user does anyway.
**Revisit when:** something outside the browser needs to increment the counter —
a webhook or a third party. That is a genuine reason for a route handler.

## 2026-08-18 — The count streams inside Suspense

**Chose:** wrap `CurrentCount` in `Suspense` with a skeleton fallback.
**Over:** awaiting the query before rendering anything.
**Why:** reading the `x-e2e-random-id` header makes this route dynamic, so
without a boundary the whole page waits on the database before any HTML is
sent. With one, the form is interactive immediately.
**Trade-off:** a brief skeleton on first paint.

## 2026-08-19 — Idempotency by mutation id, not by hoping

**Chose:** a client-generated UUID on every queued write, recorded in a
`processed_mutation` table under a unique index, inserted in the same
transaction as the increment.
**Over:** retrying a non-idempotent `count = count + n`.
**Why:** the queue retries on any ambiguous failure, and a request that
committed but whose response was lost is indistinguishable from one that never
arrived. Read-then-ack converts silent loss into at-least-once delivery, which
is the right trade only if the server can recognise a replay. Without this the
fix would have swapped lost writes for duplicated ones.
**Trade-off:** a table that grows with every write, and a migration. It needs a
retention policy before this pattern carries real data.

## 2026-08-19 — Rejected writes stay visible

**Chose:** a permanently failed row keeps its place in the store with a
`rejectedReason`, surfaced with its own count and a discard action.
**Over:** deleting it once the server refuses it.
**Why:** deleting is the same failure as dropping a write on a dead network —
the badge clears and the user concludes it saved. "Deterministic" is also only
true for a fixed deployment: a value that was legal when it was entered becomes
invalid if a later deploy narrows the range, and that is not the user's mistake.
**Trade-off:** the user has to dismiss it.

## 2026-08-19 — The form and the action validate different shapes

**Chose:** `counterIncrementInputSchema` for the form, extended with
`mutationId` for the action.
**Over:** one schema for both.
**Why:** the mutation id is generated at submit time, not typed. Requiring it in
the form's resolver made client-side validation fail before the submit handler
ran — the increment silently did nothing, with no error anywhere. Caught only by
an end-to-end test asserting the count actually moved.
**Trade-off:** two exported schemas where the slice previously had one.

## 2026-08-19 — The count is asserted inside `main`, not document-wide

**Chose:** scoping the end-to-end count locator to the `main` landmark.
**Over:** dropping the `Suspense` boundary, moving the flush off mount, or
changing what the mutation revalidates.
**Why:** the boundary streams. React writes the resolved content into a
`<div hidden>` appended to `<body>`, then moves it into the boundary from a
scheduled callback — a frame later, or up to 300ms later once another boundary
has already revealed, because reveals are throttled to avoid flashing. The queue
flushes on mount, and its `revalidatePath` re-renders the boundary in place
inside that window, leaving the staged copy stranded until the move runs. An
unscoped `getByTestId('current-count')` then matched two nodes and Playwright's
strict mode failed. Nothing was duplicated for the user: the staged copy is
`hidden`, so it is in neither the rendered page nor the accessibility tree, and
it is gone within 300ms. Measured against `next dev` the reveal ran at ~355ms
and the revalidation at ~167ms; against a production build the reveal ran at
~20ms and the revalidation at ~53ms, which is why only development reproduced
it. That ordering is a race, not a guarantee, so the fix is a locator that
cannot match a staging container rather than a timing that happens to win.
**Trade-off:** the assertion no longer notices markup rendered outside `main`.
