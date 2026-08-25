# lib/pwa — current behavior

## What this module does

Registers the service worker that makes the app load without a network.

## Behavior

- `ServiceWorkerRegistrar` is rendered once, from the locale layout. It
  registers `/sw.js` at scope `/` on mount.
- It registers in production builds only. In development it returns without
  doing anything.
- A failed registration is swallowed. The app works online without a worker;
  only offline loading is lost, and taking the page down for that trade is
  wrong.

## Where the worker comes from

`src/app/sw.ts` is the source. It is built by `pnpm exec serwist build`, which
`pnpm build:next` runs after `next build`, and the output at `public/sw.js` is
generated — it is gitignored, not committed.

This ordering is a container trap: `public/sw.js` does not exist while Next
traces files for `output: 'standalone'`, so anything that copies `public/`
before `serwist build` has run ships an image where `/sw.js` 404s and
registration fails silently. See `deploy/README.md`.

**It is not a bundler plugin.** `@serwist/next`'s plugin form does not support
Turbopack, which Next builds with by default: under the plugin the build
succeeded and silently emitted no service worker at all. The separate build step
is the supported path, and it fails loudly.

## What it caches

Two separate mechanisms, and the difference matters.

**Precached at install.** `serwist build` walks the build output and injects a
manifest into `self.__SW_MANIFEST`: the `/_next/static` chunks and build
manifests, the icons in `public/`, and every prerendered document — `/en`,
`/fr`, `/en/about`, `/fr/about` as they are named in the build output. Precache
fetches drop credentials, because the prerendered `/fr` pages respond with
`Set-Cookie: NEXT_LOCALE=fr` and precaching them otherwise switched an English
user to French on their next navigation.

**Cached at runtime.** `/_next/static/*`, `/_next/image` results, fonts, images
and CSS, per the `runtimeCaching` allow-list described next.

Content is in neither. It stays in IndexedDB and on the server: two caches over
the same data drift, and the one nobody thought about wins.

`runtimeCaching` in `src/app/sw.ts` is an explicit allow-list ending in an
unconditional `NetworkOnly` route, so anything not named above reaches the
network or fails. It is deliberately **not** `defaultCache` from
`@serwist/next/worker`: that list ends in catch-all `NetworkFirst` routes
(`pages`, `pages-rsc`, `pages-rsc-prefetch`, `others`) that store every
same-origin GET, so a signed-in `/dashboard` render would survive sign-out in a
per-browser cache the app never clears.

Subtracting the unwanted routes from `defaultCache` does not work and must not be
reintroduced. A `RuntimeCaching` entry is `{ matcher, handler, method? }` — there
is no `cacheName` on the entry, only inside the handler strategy — so
`defaultCache.filter(e => !names.includes(e.cacheName))` compares `undefined`
against the list, removes nothing, and still typechecks as an array. It fails
silently and looks correct in review.

The precache route is registered before the `runtimeCaching` entries, and routes
match in registration order, so a precached document is served from the cache
rather than falling through to the unconditional `NetworkOnly` at the end of the
list.

## Offline navigation

**Prerendered routes work offline; everything else does not.**

`stripDefaultLocale` in `src/app/sw.ts` is what makes the English half work.
Precache keys come from build output filenames, so English pages land under
`/en/*` — but with next-intl's `localePrefix: 'as-needed'` the app serves them at
`/` and `/about`, which matched no key. It rewrites `/en` to `/` and `/en/x` to
`/x` before the manifest reaches `Serwist`. It runs there rather than in a
`manifestTransforms` entry because user transforms run *before*
`@serwist/next`'s own, and it is that transform which turns
`.next/server/app/en/about.html` into `/en/about` in the first place.

What is left out is everything rendered per request: `/dashboard`, the sign-in
and sign-up routes, and the `[...rest]` catch-all. None of them are in the build
output as documents, so none are precached, and offline they reach the
`NetworkOnly` route and fail with the browser's own error page.

There is no `fallbacks` entry, so there is no offline document to show in their
place. Adding one is the remaining work: `fallbacks` resolves through
`matchPrecache`, so the document it names must itself be precached.

## Out of scope

Background sync and push notifications. Offline writes are queued in IndexedDB
by the feature that owns them and flushed on reconnect, not by the worker.
