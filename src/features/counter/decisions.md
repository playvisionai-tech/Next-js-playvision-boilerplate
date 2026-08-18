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
