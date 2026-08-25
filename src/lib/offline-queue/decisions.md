# lib/offline-queue — decisions

The first four entries were made while this code lived in
`src/features/counter/`. They moved here with it on 2026-08-21, unchanged: a
decision belongs where the code it constrains lives.

## 2026-08-19 — Idempotency by mutation id, not by hoping

**Mechanism superseded 2026-08-25** — the client-generated id and the unique
index still stand; the `processed_mutation` table it named does not. See
"2026-08-25 — The idempotency claim is the row itself" below.

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

## 2026-08-21 — Rejection requires the server's confirmation, not an attempt count

**Chose:** at `MAX_ATTEMPTS` the client asks the server whether the mutation id
is already recorded (`wasApplied`) and only rejects the row if the answer is a
clear no. If the question itself fails, the row stays pending.
**Over:** rejecting on the attempt count, which is what `recordAttempt` used to
do on its own.
**Note 2026-08-25:** the evidence below was gathered against the counter slice
and its `processed_mutation` table, both since deleted. The decision is
unchanged — only the table `wasApplied` reads has moved.
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

## 2026-08-21 — The queue is infrastructure, not part of the counter

**Chose:** move the store, the flush loop, the drain triggers and the Web Locks
leader into `lib/offline-queue`, and have the feature supply a payload type,
`send`, and `wasApplied`.
**Over:** leaving it in `features/counter/`, where it was written.
**Why:** deleting the demo slice would have deleted offline write delivery,
idempotent retry handling and most of the test suite with it. A template whose
capabilities disappear when its example is removed is not a template. The
inversion is small — the two things the queue cannot decide for itself are
exactly the two the feature already owned — and it makes the dependency point
the way the boundary rules require: feature → lib, never back.
**Trade-off:** the payload crosses an `unknown` boundary in IndexedDB, so
`listSendable` asserts the caller's type rather than proving it. The alternative
— a validator per queue — buys type safety the caller already has and adds a
failure mode (a row that no longer parses) with no honest way to handle it.

## 2026-08-21 — Rows are scoped by queue name

**Chose:** every row carries a `queue`, and every read, count and bulk action is
filtered by it.
**Over:** one global queue, since only one feature uses it today.
**Why:** without it the second caller's flush sends the first caller's payloads
to the wrong Server Action, typed as its own. That is a silent corruption
discovered in production, and the fix costs one indexed column.
**Trade-off:** the queue name is a string the caller must keep stable across
deploys. Changing it strands whatever was queued under the old name.

## 2026-08-21 — The hook reads its options through a ref

**Chose:** hold `{ queue, send, wasApplied }` in a ref, synced in an effect
declared above the drain effect, so every `useCallback` keeps an empty
dependency list.
**Over:** listing the options in the dependency arrays.
**Why:** the drain effect must run once per mount. With the options as
dependencies, a caller passing an inline arrow function makes `flush` a new
identity on every render, which re-runs the effect, which flushes, which sets
state, which renders. The React Compiler would hide it in production builds and
not in development — the worst place for that difference to live.
**Trade-off:** an in-flight flush keeps the options it started with. They are
module-level functions in practice, so there is nothing to go stale.

## 2026-08-25 — The idempotency claim is the row itself

**Chose:** let each caller's `send` be idempotent however its own table allows,
and drop the expectation of a shared claims table. The example slice does it
with a unique `mutation_id` column on `example_note` and
`onConflictDoNothing`; `wasApplied` reads that same column.
**Over:** keeping `processed_mutation` as the queue's prescribed mechanism.
**Why:** the counter it was written for is gone, and a separate claims table was
never something this module could enforce anyway — the payload is opaque here
and the write happens entirely inside the caller's `send`. What the queue
actually requires is stated in `spec.md` under "What the caller owes it": a
`send` that is idempotent on the mutation id, and a `wasApplied` that is honest.
How the caller satisfies that is its own schema's problem.
**Trade-off:** the retention concern the 2026-08-19 entry recorded moves to the
caller with it. A caller whose idempotency claims are rows that outlive their
purpose has to expire them; one whose claim is the target row, as the example
slice's is, has nothing to expire.
