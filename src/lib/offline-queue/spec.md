# lib/offline-queue — current behavior

## What this module does

Delivers writes that could not reach the server, exactly once, without losing
them and without lying about them. A feature hands over a payload; the queue
owns durability, retries, the drain triggers, and the counts the UI shows.

It knows nothing about any feature. The payload is opaque, and the two things
the queue cannot decide for itself — how to send a write, and how to ask whether
one already applied — are supplied by the caller.

## Public shape

```ts
const { pending, rejected, submit, discard, retry } = useOfflineQueue<TPayload>({
  queue,      // names this feature's rows in the shared store, and its flush lock
  send,       // (payload, mutationId) => Promise<SendResult>; throws when undelivered
  wasApplied, // (mutationId) => Promise<boolean>; throws when it cannot say
});
```

- `send` returns `{ status: 'ok' }` or `{ status: 'rejected', reason }`. Throwing
  is the third answer and the important one: it means the write may or may not
  have arrived.
- `submit(payload)` is what a form calls. It sends immediately when online and
  queues on any failure.
- `pending` and `rejected` are counts for this queue only.
- `discard()` drops the rejected rows; `retry()` returns them to the queue and
  flushes.
- `store.ts` holds the rows and is the module's other export surface —
  `enqueueWrite`, `listSendable`, `countPending`, `countRejected`, `ackWrite`,
  `recordAttempt`, `rejectWrite`, `discardRejected`, `retryRejected`,
  `MAX_ATTEMPTS`. The hook is the only expected consumer.

## Behavior

- Both files start with `import 'client-only'`, so pulling them into a server
  render is a build error rather than a runtime crash on `indexedDB is not
  defined`.
- A submit made while `navigator.onLine` is false is queued without a request.
- A submit that fails in transit is queued too: `navigator.onLine` reports a
  link, not reachability, so a captive portal or a dead origin lands here.
- A submit the server refuses is queued and immediately marked rejected, so the
  user sees a failure rather than a write that quietly vanished.
- The queue drains on mount, on the browser's `online` event, after any submit
  that reached the server, when the tab becomes visible again, and on a backoff
  timer — 2s doubling to a 30s ceiling — that runs while anything is pending.
  All of it happens under a Web Locks leader, including scheduling the timer, so
  several open tabs do not each send the same rows or each wake on their own
  clock. Where `navigator.locks` is absent — it is missing outside a secure
  context, not merely restricted — the flush still runs, unguarded.
- A row is removed only when the server confirms it. Closing the tab mid-flush
  loses nothing.
- A write that fails in transit is never rejected on the attempt count alone.
  Once it has failed `MAX_ATTEMPTS` times the queue calls `wasApplied`:
  - applied — the row is acked. The write landed and only the response was lost.
  - not applied — the row is rejected as `unreachable`.
  - the question itself throws — the row stays pending and keeps retrying.
- A rejected row keeps its place in the store with its reason. Nothing is ever
  deleted silently.
- Another tab's change is noticed through the `BroadcastChannel` that
  `lib/local-db` posts on, so the counts stay right across tabs.

## What the caller owes it

- **Idempotency.** Every row carries a client-generated `mutationId` and is
  retried freely. A `send` that is not idempotent on that id will double-apply.
- **An honest `wasApplied`.** Returning false when the answer is unknown turns a
  delivered write into a reported failure.
- **Stable functions.** `send` and `wasApplied` should be module-level or
  otherwise stable. The hook reads them through a ref so an unstable one cannot
  restart the drain, but it will not re-read them mid-flush either.

## Where the data lives

`pendingWrites` in IndexedDB, owned by `src/lib/local-db/client.ts`. A row is
the queue's envelope — `queue`, `mutationId`, `queuedAt`, `attempts`, an
optional `rejectedReason` — around the caller's opaque `payload`. Rows are
scoped by `queue`, so one feature never sends another's.

It is a queue, never a cache of server state. Browser storage is per-origin and
per-browser, not per-user, and the browser may evict it: every read must work
against an empty store.

## Access

None, and none possible. Anything in IndexedDB is readable by any script on the
origin and by anyone at that machine. The server-side check belongs in the
caller's `send` and `wasApplied`.

## Out of scope

Ordering guarantees across queues, payload validation, conflict resolution, and
expiry. A row with a permanently unanswerable status retries forever, which is
safe only because the write is idempotent.
