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

## 2026-08-21 — Rejection requires the server's confirmation, not an attempt count

**Chose:** at `MAX_ATTEMPTS` the client asks the server whether the mutation id
is already recorded (`wasApplied`) and only rejects the row if the answer is a
clear no. If the question itself fails, the row stays pending.
**Over:** rejecting on the attempt count, which is what `recordAttempt` used to
do on its own.
**Why:** a lost response and a request that never arrived are the same event on
the client. Counting attempts measures how often sending failed; it says nothing
about whether the write applied. The two could already be seen disagreeing on
screen: the streamed count included the increment while the badge underneath it
read "Could not save 1 increment". Reproduced by letting the Server Action POST
reach the server and then dropping the connection — Postgres held `count = 2`
and one `processed_mutation` claim while the UI reported failure. The
idempotency table added on 2026-08-19 already knew the answer; nothing was
asking it.
**Trade-off:** an extra round trip on the last attempt, one more Server Action
on the public surface, and an ambiguous failure now retries indefinitely instead
of settling into a wrong answer. Indefinite retries are cheap because the write
is idempotent, and a pending badge is honest in a way "Could not save" is not.
**Revisit when:** the queue carries writes that are not idempotent, or when a
row needs an expiry so a permanently unanswerable question does not retry
forever.

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

## 2026-08-21 — The drain has triggers that do not depend on `online`

**Chose:** flush after any submit that reached the server, on
`visibilitychange` when the tab becomes visible, and on a 2s → 30s backoff
scheduled inside the Web Lock.
**Over:** leaving mount and `online` as the only triggers.
**Why:** `online` fires when the network interface comes back, not when a downed
origin returns or a captive portal releases. Measured against a production
build: the server was stopped, a write was queued, and the server was restarted
without touching the interface. Nothing was written for the full 90s the test
waited. With the backoff the same run drained 1.5s after the origin came back,
in a single page load — no reload, no remount.
**Trade-off:** a timer that runs while anything is pending. It is scheduled
inside the lock, so the browser runs one of them rather than one per tab, and it
is cleared on unmount and at the top of every flush.

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
