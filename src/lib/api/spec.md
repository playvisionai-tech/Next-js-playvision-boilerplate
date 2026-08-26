# lib/api — current behavior

## What this module does

Reads third-party APIs from the browser, with a timeout, a schema check, and a
cache. It is the module `agents/rules/data-fetching-decision.md` points at for
its fourth row — "a third-party API the browser must call" — and it is for that
row only.

**It never touches this app's own data.** Anything `src/lib/db` owns reaches the
page through a Server Component or a Server Action, so a fact the database owns
has exactly one path to the screen. `src/features/example` shows both patterns
on one page for that comparison.

## Behavior

- `client.ts` holds the only `fetch` in `src/` aimed at someone else's server.
  `apiFetch(url, schema)` applies an 8-second timeout, refuses a non-2xx, and
  parses the body with Zod before returning it. A third party changing a field's
  type is an error at the boundary rather than an `undefined` inside a component.
- Every failure is an `ApiError` carrying `status` and `retryable`. `retryable`
  is decided in the transport, not at the call site: a 4xx and a body that fails
  its schema are deterministic refusals, so they are never retried; a transport
  failure and a 5xx are. This is the same distinction `src/features/example`
  draws for its own queued writes.
- `query.ts` is the only module that imports react-query's hooks.
  `createApiQueryClient()` fixes the house defaults — a 60-second `staleTime`,
  and at most two retries, gated on `ApiError.retryable`. `useApiQuery(query)`
  narrows the result to five renderable fields: `data`, `error`, `isPending`,
  `isFetching`, `refetch`.
- `provider.tsx` publishes the cache. It creates its `QueryClient` in state, so
  each mount owns one; a module-scope client would be shared by every request a
  server renders, which is one user's cache answering another user's render.
- `forecast.ts` is the one resource so far: Open-Meteo's current conditions.
  It requests `timeformat=unixtime` — Open-Meteo's ISO strings carry no offset,
  which is ambiguous the moment it leaves the timezone the request asked for —
  and maps the WMO weather code onto eight named conditions, so no component
  branches on an integer whose meaning lives in someone else's table. An
  unrecognised code is `unknown`, never a blank.
- Its `staleTime` is 5 minutes because the upstream model publishes new current
  conditions roughly every 15; asking faster returns the same numbers.
- The location is part of the query key, so two places are two cache entries.

## Where the provider is mounted

At the smallest subtree that reads a third-party API. Today that is
`src/features/example/example-view.tsx`, **not** `src/app/[locale]/layout.tsx`.

Mounting it in the root layout would place react-query in the shared client
chunk of every production page — around 10 KB gzipped — and the only consumer
today is a route that does not exist in a production build. Deleting the example
slice would also leave the provider mounted and consumed by nothing.

**When to promote it:** the first feature that reaches a production route and
uses this module moves the mount to `[locale]/layout.tsx`. At that point one
cache shared across client-side navigation is worth more than the bytes, and the
production build starts type-checking the provider again — see the coverage gap
below.

## What the cache is, and the two rules that keep it that way

The query cache is **React state with an invalidation policy — not a storage
tier.** It does not survive a reload, is not shared between browsers, and owns
no fact: every entry is a timestamped copy of a value that is authoritative
somewhere else. Under AGENTS.md's tier test ("must not survive a reload → React
state or the URL") that is where it lands.

Two rules keep that description true. Both are properties of this module, not
observations about today's code:

1. **The cache has no persister.** Nothing writes it to `localStorage` or
   IndexedDB. Adding `persistQueryClient` moves it into the browser-storage tier
   for real, and it would then be ask-first under AGENTS.md's "persisting
   anything new in the browser" and would have to answer to
   `src/lib/local-db/spec.md`'s per-origin, evictable, absent-during-SSR
   properties.
2. **The cache never holds a fact `src/lib/db` owns.** Server data is read by a
   Server Component and written by a Server Action. Caching it here as well
   would put the same fact in two tiers with two independent invalidations, and
   they would disagree the moment a Server Action ran.

## Third-party origins

One origin was added to the CSP in `next.config.ts` for this module:

- `https://api.open-meteo.com` on `connect-src` — the browser fetches the
  forecast from it directly. Nothing is added to `script-src`, `img-src` or
  `frame-src`: no script is loaded, no pixel, no embed.

Open-Meteo answers with `access-control-allow-origin: *` and needs no key, so
there is no server tier and nothing in `src/lib/env.ts` for this module. The
policy ships report-only, so a missing origin here is silent until it is
enforced.

## What CI does not cover

**This module gets no browser coverage in CI, and nobody should read "tested"
as meaning otherwise.**

Its only consumer is `src/features/example`, whose route is `page.dev.tsx` and
therefore does not exist in a production build. CI runs Playwright against
`next start`, so `/example` is not a route there — `e2e/offline.e2e.ts` already
skips itself on CI for the same reason. No end-to-end run fetches Open-Meteo,
renders the card, or reads the console for a CSP violation.

What does cover it:

- `__tests__/client.test.ts`, `__tests__/forecast.test.ts` and
  `__tests__/query.test.ts` in the node project — transport, mapping, defaults.
- `__tests__/provider.test.tsx` in the browser project — a real browser renders
  the provider and a `useApiQuery` consumer, including the failure path.
- `e2e/security-headers.e2e.ts` asserts the `connect-src` origin against `/`,
  which is a production route, so the header half does run in CI.

Two things follow from the same cause. Because the production build never
reaches this code, `pnpm build-local` does not bundle it either: a missing
`'use client'` here would not fail the build the way it would elsewhere.
`pnpm check:types` and `pnpm check:boundaries` read all of `src/` regardless, so
only the bundler's signal is missing.

## Known risk: the React Compiler

`reactCompiler` is on for production builds only. react-query tracks which
result fields a component reads through a Proxy, and a compiler that memoizes
those reads can narrow the subscription. `useApiQuery` reads all five fields on
every render, unconditionally, which keeps the tracked set stable from the first
render — the same class of problem `src/features/example/components/note-form.tsx`
answers with `'use no memo'`. Nothing here runs in a production build today, so
the interaction is documented rather than observed.

## Access

None, and none possible. Everything this module fetches is public data from a
keyless API, and everything it holds is readable by any script on the origin.

## Out of scope

Mutations. `useMutation` is not wrapped and should not be: writes to our own
data are Server Actions. A third-party API that must be *written* from the
browser is a new decision, not an extension of this one.

Server-side prefetch and hydration. react-query's `HydrationBoundary` would let
a Server Component prefetch and the browser resume, and it is the reason this
library was chosen over a smaller one — but nothing needs it yet, and an unused
hydration path is one more thing to keep true.
