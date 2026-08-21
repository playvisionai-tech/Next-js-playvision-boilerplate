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

## 2026-08-21 — `queries.ts` became a Server Action module

**Chose:** `'use server'` at the top of `server/queries.ts`, so `wasApplied` is
callable from the offline queue.
**Over:** a third module holding one action, or re-exporting the query through
`server/mutations.ts`.
**Why:** the confirmation lookup is a read, and putting a read in the mutations
module to borrow its directive would misfile it. `getCurrentCount` becomes
reachable over HTTP as a side effect, which is acceptable only because this
counter is public and unauthenticated by design.
**Trade-off:** every export of this file is now a public endpoint. A feature
owning per-user data must not copy this shape — it needs a module whose exports
are all safe to expose, and its own access check in each one.

## 2026-08-21 — `wasApplied` lives in its own action file, not in queries.ts

**Chose:** a separate `server/mutation-status.ts` carrying `'use server'`.
**Over:** adding `'use server'` to `server/queries.ts`, which is where it first
landed.
**Why:** the directive is file-level. Marking `queries.ts` would have turned
every export in it — including `getCurrentCount` — into a callable public
endpoint, purely so the browser could reach one status check. That is a real
widening of the attack surface, and it happens to be harmless here only because
this counter is public. Keeping reads unexported preserves the rule that
`queries.ts` is internal and only `'use server'` files are reachable from a
client.
**Trade-off:** one more file in the slice.

## 2026-08-21 — The offline queue moved to `lib/offline-queue`

**Chose:** keep the increment payload, `incrementCounter`, `wasApplied` and the
counter row id here, and hand the rest — the pending store, the flush loop, the
drain triggers, the Web Locks leader and the confirmation rule — to
`lib/offline-queue`. `use-counter-queue.ts` binds the two together.
**Over:** leaving the queue in this slice, where it was written.
**Why:** deleting this demo would have deleted offline write delivery with it.
The four decisions that constrain queue behaviour — idempotency by mutation id,
rejected writes staying visible, confirmation before rejection, and the drain
triggers — moved to `src/lib/offline-queue/decisions.md` unchanged.
**Trade-off:** one more indirection between the form and the Server Action, and
`send` now flattens `IncrementResult` into the queue's smaller `SendResult`, so
`count` and `replayed` are dropped on the queued path. Nothing read them.
