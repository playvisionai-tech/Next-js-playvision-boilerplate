# lib/local-db — current behavior

## What this module does

Owns the browser's IndexedDB database: its name, its version, and every store.
Features import `localDb` from here and write their own queries; they never open
their own connection.

## Behavior

- `client.ts` starts with `import 'client-only'`, so pulling it into a server
  render is a build error rather than a runtime crash on `indexedDB is not
  defined`.
- One database, `playvision-local`, at version 1. Stores: `pendingIncrements`.
- `announceChange(store)` posts to a `BroadcastChannel` so other tabs know to
  re-read. The message carries the store name and nothing else.

## Where the data lives

IndexedDB, in the browser. Three properties that shape everything built on it:

- **Per-origin and per-browser, not per-user.** Two profiles and a private
  window are three separate databases; one shared computer means two people
  share one store. Never put user-specific data here without clearing it on
  logout.
- **Evictable.** The browser may delete it under storage pressure, and Safari's
  ITP does so aggressively. Every read must work against an empty store.
- **Absent during server rendering.** The first render must produce something
  sensible without it.

## Access

None enforced here, and none possible: anything in IndexedDB is readable by any
script on the origin and by anyone at that machine. It is not an access
boundary.

## Out of scope

Sync. This module stores; it does not reconcile. Two browser stores cannot sync
to each other — anything crossing a device or a person needs the server as
arbiter.
