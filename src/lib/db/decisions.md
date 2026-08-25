# lib/db — decisions

## 2026-08-21 — Idempotency keys are scoped to their target row

**Superseded 2026-08-25** — `processed_mutation`, and the counter slice it
served, no longer exist. See "2026-08-25 — The idempotency key lives on the row
it protects" below. Kept because it is the reason a bare `mutation_id` index is
only safe on a table whose rows *are* the target.

**Chose:** a composite unique index on `(counter_id, mutation_id)` in
`processed_mutation`, with the target resolved before the claim.
**Over:** a unique index on `mutation_id` alone, which is what shipped first.
**Why:** keyed on the id alone, a mutation id already claimed against one row
silently swallowed a write aimed at a different row — and reported `ok`.
Unreachable while every request resolved to the same counter, and silent data
loss the moment the target became per-user. Proven at the database level: the
same id now claims against two different targets and is still blocked on replay
against the same one.
**Trade-off:** `counter_id` is a plain column rather than a foreign key, because
the claim is inserted before the counter row is upserted and a constraint would
fail on the very first write.

## 2026-08-21 — One migration, regenerated rather than stacked

**Chose:** delete the migration history and regenerate a single migration from
the current schema.
**Over:** an incremental migration adding the column and swapping the index.
**Why:** nothing is deployed and no database holds data worth preserving, so the
history recorded steps no environment had ever taken. A clean base is easier to
read than a chain describing a schema that never ran anywhere.
**Revisit when:** the first environment is deployed. From that point migrations
are append-only, because somewhere a database is already at a known revision.

## Known limitation — processed_mutation grows without bound

**Superseded 2026-08-25** — there is no claims table today, so nothing here
grows unbounded: the idempotency key is a column on `example_note`, and the only
rows are the notes themselves. Kept because the limitation returns with the
first claims table.

Every write adds a row and nothing removes them. Acceptable while this is a demo
counter; before the pattern carries real traffic it needs a retention job
deleting rows older than the longest plausible offline window.

## 2026-08-25 — The idempotency key lives on the row it protects

**Chose:** a unique `mutation_id` column on `example_note`, the row the write
creates, and no separate claims table.
**Over:** keeping `processed_mutation` and its composite index.
**Why:** the counter slice it was built for is gone, and with it the gap the
composite index closed — an id claimed against one row while the write aimed at
another. A mutation that inserts its own row has no such gap: the claim and the
target are the same row, so `onConflictDoNothing` on the unique column is the
idempotency check and the write in one statement, and it is what `wasApplied`
reads to answer whether a queued write already landed.
**Trade-off:** this does not generalise to a mutation that updates an existing
row rather than inserting one. That case needs a claim scoped to its target
again, and the 2026-08-21 entry above is the record of how — including why the
key must carry the target and not just the id.
