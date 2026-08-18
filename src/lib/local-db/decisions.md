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

**Chose:** to leave it out.
**Over:** shipping an unused `clearLocalDb`.
**Why:** nothing stored here is user-specific — the queue holds increments to a
public counter. An unused helper implies a policy that is not actually enforced
anywhere.
**Revisit when:** anything user-specific is persisted. At that point clearing on
logout becomes mandatory, including in the other open tabs, because IndexedDB is
per-browser and not per-user.
