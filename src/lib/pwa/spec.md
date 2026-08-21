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

Build assets only: `/_next/static/*`, `/_next/image` results, fonts, images and
CSS. Content stays in IndexedDB and on the server. Two caches over the same data
drift, and the one nobody thought about wins.

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

**Offline navigation does not work yet.** `serwist.config.js` sets
`globDirectory: '.next'`, whose files are not served at those URLs, so the
injected manifest is empty (`precacheEntries` compiles to `[]`) and no document
is precached. Restoring offline navigation needs a real precache manifest plus a
`fallbacks` entry pointing at a precached offline document — `fallbacks` resolves
through `matchPrecache`, so it is inert until precaching works.

## Out of scope

Background sync and push notifications. Offline writes are queued in IndexedDB
by the feature that owns them and flushed on reconnect, not by the worker.
