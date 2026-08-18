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

**It is not a bundler plugin.** `@serwist/next`'s plugin form does not support
Turbopack, which Next builds with by default: under the plugin the build
succeeded and silently emitted no service worker at all. The separate build step
is the supported path, and it fails loudly.

## What it caches

The app shell — HTML, JS, CSS — and nothing else. Content stays in IndexedDB and
on the server. Two caches over the same data drift, and the one nobody thought
about wins.

## Out of scope

Background sync and push notifications. Offline writes are queued in IndexedDB
by the feature that owns them and flushed on reconnect, not by the worker.
