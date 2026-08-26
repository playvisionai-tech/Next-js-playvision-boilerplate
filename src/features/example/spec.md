# Example — DELETE THIS SLICE ONCE YOU HAVE READ IT

It is a worked reference, not a capability. Nothing else imports it, and it does
not exist in a production build.

## Deleting it

1. `rm -rf src/features/example src/app/\[locale\]/\(marketing\)/example`
2. Remove the `Example`, `ExampleForm`, `ExampleList` and `ExampleForecast`
   namespaces from every file in `src/messages/`.
3. Remove the example's nav link from
   `src/app/[locale]/(marketing)/layout.tsx` (the block guarded by `Env.NODE_ENV`),
   and the `RootLayout.example_link` key it reads from every file in
   `src/messages/`. That key is outside the namespaces in step 2, and
   `pnpm check:i18n` fails on a key nothing uses.
4. Remove `exampleNoteSchema` from `src/lib/db/schema.ts`, then
   `pnpm db:generate`.
5. Remove the `./src/features/example` zone from `eslint.boundaries.config.mjs`.
6. Remove `e2e/offline.e2e.ts` — this slice is its subject.
7. Remove `src/app/**/*.dev.tsx` from `entry` in `knip.config.ts`, and the
   `dev.tsx` block from `next.config.ts` if nothing else uses it.
8. `src/lib/api` stays. It is infrastructure, not part of this slice — but this
   slice is its only caller today, so if nothing else has adopted it, remove it
   too, along with its `connect-src` origin in `next.config.ts` and
   `@tanstack/react-query` from `package.json`. Its `spec.md` says where the
   provider would move instead.
9. `pnpm verify`.

## What this slice does

A note board with a weather card under it. The board is a form that stores a
short line of text and a list of the ten most recent; the card reads the current
conditions for one city from a third-party API. It exists to exercise every tier
of the structure — client form, shared schema, Server Action, server query,
offline write queue, third-party read — on something small enough to read in one
sitting.

**The two halves are here to be compared.** The notes are ours, so a Server
Component reads them and a Server Action writes them. The forecast is someone
else's, on the far side of CORS, and it changes while the page is open, so the
browser fetches it through `src/lib/api`. That is rows one, two and four of
`agents/rules/data-fetching-decision.md` on one screen. Neither pattern is the
default for the other's job.

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
- The forecast card renders a skeleton until the first response, the reading
  once it arrives, and an `ErrorState` with a retry when the request fails. Its
  refresh button refetches on demand; react-query also refetches when the window
  regains focus, and serves the cached reading for five minutes before it does.
- A forecast that fails is not queued. The offline queue carries this app's own
  writes; a third party being unreachable is a card that says so and offers a
  retry.
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
against a dev server. That coverage is `e2e/offline.e2e.ts`, and it opts itself
out with a file-level `test.skip(process.env.CI === 'true', ...)`, because CI
serves a production build where `/example` is not a route. The skip lives in the
test file rather than in `playwright.config.ts`: the reason is a property of
what the file tests, and a config-level exclusion would be invisible to whoever
opens it and wonders why it never ran. The queue's own rules are covered
deterministically on every CI run by `src/lib/offline-queue/__tests__/store.test.ts`.

## Entry points

- Route: `src/app/[locale]/(marketing)/example/page.dev.tsx` → `example-view.tsx`
- Third-party read: `components/forecast-card.tsx`, a client component calling
  `useApiQuery` from `src/lib/api`. `example-view.tsx` mounts `ApiProvider`
  around it — deliberately there rather than in the root layout, so react-query
  ships with this slice and not with every production page. See
  `src/lib/api/spec.md`.
- Server: `server/queries.ts` (`listNotes`, internal — no `'use server'`, so it
  is not a public endpoint), `server/mutations.ts` (`addNote` and `wasApplied`,
  both reachable from the browser because the directive is file-level).
- Client state: `use-example-queue.ts`, which binds `lib/offline-queue` to this
  slice's mutation and its idempotency check.
- Shared: `schema.ts` — the only module both sides import. It exports two
  schemas: the form validates the user's input, the action validates that plus
  the `mutationId`, which is not user input.

## Where the data lives

Two tiers for the notes, and the server is authoritative. The forecast is in
neither: it belongs to Open-Meteo, and this app keeps only an in-memory copy of
it for as long as the card is mounted.

**Server database** — the `example_note` table (`src/lib/db/schema.ts`) holds
the notes. `mutation_id` is unique, which is both the idempotency key and the
answer `wasApplied` reads.

**Browser storage** — rows in the shared `pendingWrites` store in IndexedDB
(`src/lib/local-db/client.ts`), under the queue name `example`. Each carries
`{ body }` as its payload plus the queue's envelope. It is a queue, never a
cache of the notes, and rows leave it only when the server confirms them.

**Nowhere durable** — the forecast. The query cache holds it in memory and a
reload fetches it again. Nothing about the weather is written to IndexedDB, and
nothing about the notes is put in the query cache; `src/lib/api/spec.md` states
both as rules. Keeping those two apart is most of what this pairing is here to
show.

## Access

None. The board is public and unauthenticated because it is a demonstration,
not a user-owned resource. A real feature owning per-user data would re-check
access in both `queries.ts` and `mutations.ts`, where the row and the session
are both in scope. `src/app/[locale]/(auth)/dashboard/` is the worked example of
a route that is not public.

## Out of scope

Editing, deleting, paging, and ordering by anything but insertion. A location
picker for the forecast, which would demonstrate one more thing about query keys
and one less thing about restraint. The slice is deliberately minimal; adding to
it makes it worse as a reference.
