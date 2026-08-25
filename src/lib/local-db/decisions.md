# lib/local-db — decisions

## 2026-08-18 — One database, owned here; features own only their queries

**Chose:** a single Dexie database with one version number and every store
declared in `client.ts`. Features write queries in `features/<f>/local/`.
**Over:** one database per feature.
**Why:** IndexedDB versioning is global per database name. Two features opening
the same database at different versions block each other, and the symptom is a
hang rather than an error — the worst possible failure to debug.
**Trade-off:** the version is a shared resource, so adding a store means editing
a file outside your feature. That friction is the point; it makes the schema
change visible in review.

## 2026-08-18 — BroadcastChannel carries signals, not values

**Chose:** post `{ store }` and let each tab re-read IndexedDB.
**Over:** broadcasting the new value to other tabs.
**Why:** broadcasting values makes every tab a writer with no arbiter, and
last-message-wins reorders under load. One store, many readers, is the
invariant worth protecting.
**Trade-off:** an extra read per tab per change. Immaterial at these data sizes.

## 2026-08-18 — Dexie over raw idb

**Chose:** Dexie.
**Over:** the `idb` wrapper, or the raw IndexedDB API.
**Why:** versioned migrations and typed tables are the two things this module
exists to centralise, and Dexie gives both directly. Raw IndexedDB would mean
hand-writing upgrade transactions, which is where this kind of code goes wrong.
**Trade-off:** a dependency, and Dexie's own API surface to learn.
**Revisit when:** the store list stays trivial and the bundle cost starts to
matter.

## 2026-08-18 — No clear-on-logout helper yet

**Rationale updated 2026-08-25** — the counter is gone; the queue now holds
notes for a public board. Still nothing user-specific, so the choice stands. See
"2026-08-25 — The counter references in the entries above are historical" below.

**Chose:** to leave it out.
**Over:** shipping an unused `clearLocalDb`.
**Why:** nothing stored here is user-specific — the queue holds increments to a
public counter. An unused helper implies a policy that is not actually enforced
anywhere.
**Revisit when:** anything user-specific is persisted. At that point clearing on
logout becomes mandatory, including in the other open tabs, because IndexedDB is
per-browser and not per-user.

## 2026-08-21 — The pending store is generic, at the cost of what was queued

**Chose:** version 3 replaces `pendingIncrements` with `pendingWrites`, whose
rows are a fixed envelope around an opaque `payload`. Rows in the old store are
dropped, not carried across.
**Over:** migrating them, or leaving the store counter-shaped.
**Why:** a store named after one feature makes the shared version number a
feature's property, and the queue that reads it could never serve a second
caller. Carrying the rows across would mean mapping `increment` onto a payload
and inventing a queue name for them — knowledge of the counter, written into the
one module that must not have any. Dropping repeats what v1 → v2 already chose
for the same reason.
**Trade-off:** a browser holding queued writes at the moment it loads this
version loses them, silently. That is the failure `lib/offline-queue` exists to
prevent, accepted here only because the sole payload today is a demo counter's
increment.
**Revisit when:** a feature queues writes a user would miss. Then the row needs
a version of its own, so the payload can be migrated by whoever understands it,
and the upgrade must run before the store is dropped — Dexie runs an upgrade
function before deleting that version's removed stores, so both can still be
read in the same transaction.

## 2026-08-25 — The counter references in the entries above are historical

**Chose:** leave the two 2026-08-18 and 2026-08-21 entries that name a demo
counter in place, and record here what the store actually holds.
**Over:** rewriting them to say "note".
**Why:** the counter slice was deleted and `src/features/example/` replaced it,
so the sole payload in `pendingWrites` today is a note body — `{ body }` under
the queue name `example`. The entries above weighed a real trade-off against
what was queued *then*, and the weighing is the part worth keeping: an entry
edited to match today's code stops being a record of the decision.
**Trade-off:** a reader has to check the date on an entry before reading its
examples as current. That is what dating them is for.
**Revisit when:** anything user-specific is persisted here. Neither the counter
nor the note is, which is the only reason there is still no clear-on-logout
helper.
