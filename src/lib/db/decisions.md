# lib/db — decisions

## 2026-08-21 — Idempotency keys are scoped to their target row

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

Every write adds a row and nothing removes them. Acceptable while this is a demo
counter; before the pattern carries real traffic it needs a retention job
deleting rows older than the longest plausible offline window.
