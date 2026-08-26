# lib/local-db — current behavior

## What this module does

Owns one IndexedDB database, `playvision-local`: its name, its version, and
every store in it. Features import `localDb` from here and write their own
queries; they never open their own connection.

It does not own the origin's IndexedDB. Other databases sit beside
`playvision-local` — see **What else is on the origin** — and nothing here can
see, version, or clear them.

## Behavior

- `client.ts` starts with `import 'client-only'`, so pulling it into a server
  render is a build error rather than a runtime crash on `indexedDB is not
  defined`.
- One database, `playvision-local`, at version 3. Stores: `pendingWrites`, the
  shared queue of writes waiting for the server. Its rows are a fixed envelope —
  `queue`, `mutationId`, `queuedAt`, `attempts`, `rejectedReason` — around an
  opaque `payload`, so no feature's shape reaches this file.
  `src/lib/offline-queue` owns the reading and writing of them.
- `announceChange(store)` posts to a `BroadcastChannel` so other tabs know to
  re-read. The message carries the store name and nothing else.

## Where the data lives

IndexedDB, in the browser. Three properties that shape everything built on it —
and they hold for every database on the origin, not only this one:

- **Per-origin and per-browser, not per-user.** Two profiles and a private
  window are three separate databases; one shared computer means two people
  share one store. Never put user-specific data here without clearing it on
  logout.
- **Evictable.** The browser may delete it under storage pressure, and Safari's
  ITP does so aggressively. Every read must work against an empty store.
- **Absent during server rendering.** The first render must produce something
  sensible without it.

## What else is on the origin

`src/lib/firebase` initializes the Firebase web SDK, and the SDK opens its own
databases as a side effect of starting. Three of them:

- `firebase-installations-database`, store `firebase-installations-store` —
  the Firebase Installation ID and its refresh token. Opened by
  `@firebase/installations`, which Analytics depends on and does not start
  without.
- `firebase-heartbeat-database`, store `firebase-heartbeat-store` — at most one
  row per day recording which SDK versions ran. Opened by `@firebase/app`.
- `firebase_remote_config`, store `app_namespace_store` — the fetched config
  payload and its fetch metadata. Opened by `@firebase/remote-config`.

Their names, versions, schemas, and lifetimes belong to the vendor. This module
does not create them, cannot migrate them, and does not clear them: deleting
`playvision-local` leaves all three intact. They are described here because
anyone reading the origin's storage will find them and needs to know which
module answers for them — and the answer is `src/lib/firebase`, not this one.

## The Installation ID breaks the rule above, and knowingly

The FID in `firebase-installations-database` is a durable, server-registered
pseudonymous identifier: the SDK registers it with Google, keeps the refresh
token beside it, and reuses the same one across sessions. Clerk sign-out does
not touch it. On a shared machine the next person to sign in inherits the
previous person's installation, and whatever Analytics attributed to that FID
follows them.

That is exactly the thing **Where the data lives** says never to do. The rule is
right and this database violates it. Clearing the FID takes an explicit
`deleteInstallations()` call in the sign-out path; until something makes that
call, it is user-linked storage with no clear-on-logout step, and it should be
read as a known gap rather than an accepted design.

## Access

None enforced here, and none possible: anything in IndexedDB is readable by any
script on the origin and by anyone at that machine. That covers the vendor
databases too — the FID and the cached Remote Config payload are as readable as
`pendingWrites`. It is not an access boundary.

## Out of scope

Sync. This module stores; it does not reconcile. Two browser stores cannot sync
to each other — anything crossing a device or a person needs the server as
arbiter.

The vendor databases. They are named above so the origin's storage is
accounted for; owning them is `src/lib/firebase`'s job.
