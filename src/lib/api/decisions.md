# lib/api — decisions

## 2026-08-26 — `@tanstack/react-query` for browser-side reads, over SWR and over nothing

`agents/rules/data-fetching-decision.md` has two rows that need a library this
repo did not have — data that changes after load without navigation, and a
third-party API the browser must call. Both said "propose one". This is that
proposal's outcome.

**Rejected: nothing, fetched on the server.** A Server Component can call
Open-Meteo directly and `fetch`'s `next: { revalidate }` would cache it, for
zero client bytes. It remains the right answer for third-party data that is
merely displayed, and anything that only needs displaying should still do it
that way. It was rejected here because it cannot refresh while the page is open,
cannot take parameters the browser alone knows, and puts our server in the path
of a third party's uptime with one shared per-deploy cache instead of one per
browser.

**Rejected: writing it in-repo.** A `useFetch` hook is about sixty lines.
Deduplicating concurrent callers, cancelling on unmount, discarding a stale
response that arrives after a newer one, backing off on retry, refetching on
focus and reconnect, and keying a cache with invalidation are not. Same
reasoning as `src/lib/firebase/decisions.md`: forty lines is a fair trade, this
is not forty lines.

**Rejected: `swr`.** 6.4 KB gzipped against react-query's 9.9 KB, measured the
same way, and simpler for read-only fetching, which is all this module does
today. Rejected on where this goes next rather than on this feature:
react-query's `HydrationBoundary` gives a real server-prefetch → client-hydrate
handoff for the first production feature that needs one, its invalidation model
is what a mutation-heavy slice will want, and the App Router documentation the
ecosystem writes is written against it. If that trajectory never materialises,
SWR was the better call and 3.5 KB says so.

**Chosen: `@tanstack/react-query@^5.102.3`**, one transitive dependency
(`@tanstack/query-core`, pinned exact, zero dependencies of its own), no install
scripts, `peerDependencies` of `react ^18 || ^19`, `sideEffects: false`, and
per-file `'use client'` directives in the published build.

`@tanstack/react-query-devtools` was deliberately not taken. It is a second
package and a second decision; it can be proposed when someone is actually
debugging a cache.

## 2026-08-26 — `^5.102.3`, not the `^5.102.5` that was approved

The proposal named 5.102.5, published the same morning. `pnpm add` resolved
5.102.3 and reported "Lockfile passes supply-chain policies": pnpm 11 will not
take a version younger than its minimum release age, and 5.102.4 and 5.102.5
were both hours old.

The lower version was kept rather than forced. Pinning past that gate to win two
patch releases is exactly the trade the gate exists to refuse, and nothing in
this module depends on what changed between them.

## 2026-08-26 — The provider mounts in the slice, not in the root layout

`src/app/[locale]/layout.tsx` already nests `NextIntlClientProvider` and
`FirebaseProvider`, and a third would have been the conventional place for this
one. It would also have put react-query — around 10 KB gzipped — in the shared
client chunk of every production page, for a consumer that exists only in
development: the example slice's route is `page.dev.tsx`, and `next.config.ts`
registers `dev.tsx` as a page extension outside production only. Deleting the
slice, which its own `spec.md` tells you to do, would have left the provider
mounted and consumed by nothing — the shape this repo already named when it
found `NEXT_PUBLIC_POSTHOG_KEY` declared and read by nothing.

The cost is real and is recorded in `spec.md` rather than left to be
rediscovered: the production build never reaches these files, so `build-local`
does not bundle them and a missing `'use client'` would not fail it. Types and
import boundaries still cover the module, and `__tests__/provider.test.tsx`
renders it in a real browser.

The mount promotes to the root layout when the first production route uses this
module.

## 2026-08-26 — Two import sites for the package, not one

`agents/skills/add-dependency/SKILL.md` asks for exactly one import site per
third-party package. This lands at two, both inside `src/lib/api/`: `query.ts`
for the hooks and the client factory, `provider.tsx` for `QueryClientProvider`.

The skill exempts "a provider mounted once in `[locale]/layout.tsx`", and this
provider is deliberately not mounted there, so the exemption does not apply and
is not being claimed. The reason is independent of it: `provider.tsx` carries
`'use client'` and JSX, and folding it into `query.ts` would drag a client
boundary into every module that wants only the fetch defaults. Two files inside
one wrapper module keep the swap cost at one directory, which is what the rule
is protecting.

`grep -rn "@tanstack/react-query" src/ --include="*.ts" --include="*.tsx" |
grep -v "^src/lib/api/"` returns nothing, and that is the invariant worth
checking on review. Without the `--include` filters it also matches this file
and the example slice's deletion checklist, which are prose, not import sites.

## 2026-08-26 — The transport decides what may be retried, not the call site

`ApiError` carries `retryable`, set in `apiFetch` from the status and from
whether the body parsed. The query client's retry predicate reads that field and
nothing else — it does not inspect status codes itself, and it does not retry an
error that is not an `ApiError`, because every error a query function throws
comes from the transport and anything else is our own bug repeating.

The alternative was a retry predicate that pattern-matches on status at the
query-client level. That puts the same knowledge in two places and gets it wrong
for the case that motivated this: a 200 whose body does not match its schema is
a refusal too, and no status code says so.
