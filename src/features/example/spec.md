# Example — DELETE THIS SLICE ONCE YOU HAVE READ IT

It is a worked reference, not a capability. Nothing else imports it, and it does
not exist in a production build.

## Deleting it

1. `rm -rf src/features/example src/app/\[locale\]/\(marketing\)/example`
2. Remove the `Example`, `ExampleForm` and `ExampleList` namespaces from every
   file in `src/messages/`.
3. Remove the example's nav link from
   `src/app/[locale]/(marketing)/layout.tsx` (the block guarded by `Env.NODE_ENV`).
4. Remove `exampleNoteSchema` from `src/lib/db/schema.ts`, then
   `pnpm db:generate`.
5. Remove the `./src/features/example` zone from `eslint.boundaries.config.mjs`.
6. Remove `e2e/example.dev.e2e.ts`.
7. Remove `src/app/**/page.dev.tsx` and `src/app/**/loading.dev.tsx` from
   `entry` in `knip.config.ts`, and the `dev.tsx` block from `next.config.ts`
   if nothing else uses it.
8. `pnpm verify`.

## What this slice does

A note board: a form that stores a short line of text, and a list of the ten
most recent. It exists to exercise every tier of the structure — client form,
shared schema, Server Action, server query, offline write queue — on something
small enough to read in one sitting.

## Behavior

- The form accepts a note of 1–80 characters and validates it in the browser
  with `schema.ts`.
- Submitting calls the `addNote` Server Action, which re-validates the same
  payload with the same schema before touching the database.
- An empty or over-long note never reaches the server: the form blocks it and
  shows the length error. A payload that reaches the action anyway returns
  `{ status: 'invalid' }` and writes nothing.
- After a successful write the action calls `revalidatePath`, so the list
  re-renders on the server.
- Offline, or when the request fails, the note is queued by `lib/offline-queue`
  and the form shows how many writes are waiting. The queue owns durability,
  retries and the drain; this slice owns what a queued row means.
  `use-example-queue.ts` supplies the two things the queue cannot decide for
  itself: `send`, which calls `addNote` and reports only `ok` or a refusal, and
  `wasApplied`, which answers whether an id already landed. See
  `src/lib/offline-queue/spec.md` for the delivery behavior.
- A write the server refuses (`status: 'invalid'`) is reported to the queue as a
  rejection and is not retried: the refusal is deterministic, so retrying it
  cannot help. Anything else throws, which is what tells the queue the write may
  still have landed.
- A rejected write is shown separately with retry and discard actions. Nothing
  is ever deleted silently.
- Retries are safe to repeat: every queued write carries a `mutationId`, and the
  unique index on that column means an id is stored at most once.
- The list streams inside `Suspense`, so the form is interactive before the
  database has answered. React reveals a streamed boundary from a scheduled
  callback rather than as the markup arrives, so between the stream and the
  reveal the resolved list sits in a `hidden` staging container appended to
  `<body>`. End-to-end assertions on the list are scoped to `main` for that
  reason.

## Why it is dev-only

The route file is `page.dev.tsx`, and `dev.tsx` is registered in
`pageExtensions` only when `NODE_ENV !== 'production'` (see `next.config.ts`).
Outside development Next does not recognise the file as a route at all: it is
absent from the route manifest, nothing imports this slice, and none of it is
bundled. A runtime `notFound()` would have shipped the code and only hidden it.

The trade-off is that end-to-end coverage of the offline queue can only run
against a dev server, so `e2e/example.dev.e2e.ts` is excluded on CI, where
Playwright serves a production build. `playwright.config.ts` says so.

## Entry points

- Route: `src/app/[locale]/(marketing)/example/page.dev.tsx` → `example-view.tsx`
- Server: `server/queries.ts` (`listNotes`, internal — no `'use server'`, so it
  is not a public endpoint), `server/mutations.ts` (`addNote` and `wasApplied`,
  both reachable from the browser because the directive is file-level).
- Client state: `use-example-queue.ts`, which binds `lib/offline-queue` to this
  slice's mutation and its idempotency check.
- Shared: `schema.ts` — the only module both sides import. It exports two
  schemas: the form validates the user's input, the action validates that plus
  the `mutationId`, which is not user input.

## Where the data lives

Two tiers, and the server is authoritative.

**Server database** — the `example_note` table (`src/lib/db/schema.ts`) holds
the notes. `mutation_id` is unique, which is both the idempotency key and the
answer `wasApplied` reads.

**Browser storage** — rows in the shared `pendingWrites` store in IndexedDB
(`src/lib/local-db/client.ts`), under the queue name `example`. Each carries
`{ body }` as its payload plus the queue's envelope. It is a queue, never a
cache of the notes, and rows leave it only when the server confirms them.

## Access

None. The board is public and unauthenticated because it is a demonstration,
not a user-owned resource. A real feature owning per-user data would re-check
access in both `queries.ts` and `mutations.ts`, where the row and the session
are both in scope. `src/app/[locale]/(auth)/dashboard/` is the worked example of
a route that is not public.

## Out of scope

Editing, deleting, paging, and ordering by anything but insertion. The slice is
deliberately minimal; adding to it makes it worse as a reference.
