/// <reference lib="webworker" />

import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist';

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging into WorkerGlobalScope requires an interface.
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

/**
 * The routes the worker is allowed to cache at runtime, in match order.
 *
 * This is an explicit allow-list, not `defaultCache` from `@serwist/next/worker`
 * with the unwanted routes removed. `defaultCache` ends in a catch-all that
 * stores every same-origin GET — rendered HTML and RSC payloads included — in a
 * per-browser cache with no clear-on-logout step, so a signed-in page survives
 * sign-out and is readable by the next person at that machine. Subtracting from
 * that list means a new default route in a future Serwist release starts caching
 * responses here silently; enumerating what may be cached means it does not.
 *
 * Every entry below is a build asset addressed by an immutable, content-hashed
 * URL or a public static file. None of them vary per user.
 */
const runtimeCaching: RuntimeCaching[] = [
  {
    // Content-hashed, immutable: safe to serve from the cache without revalidating.
    matcher: /\/_next\/static\/.+/iu,
    handler: new CacheFirst({
      cacheName: 'next-static-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 30 * ONE_DAY_IN_SECONDS,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  {
    matcher: /\/_next\/image\?url=.+$/iu,
    handler: new StaleWhileRevalidate({
      cacheName: 'next-image',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: ONE_DAY_IN_SECONDS,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  {
    matcher: /\.(?:eot|otf|ttc|ttf|woff|woff2)$/iu,
    handler: new CacheFirst({
      cacheName: 'static-font-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 8,
          maxAgeSeconds: 365 * ONE_DAY_IN_SECONDS,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  {
    matcher: /\.(?:jpg|jpeg|gif|png|svg|ico|webp|avif)$/iu,
    handler: new StaleWhileRevalidate({
      cacheName: 'static-image-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 30 * ONE_DAY_IN_SECONDS,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  {
    matcher: /\.css$/iu,
    handler: new StaleWhileRevalidate({
      cacheName: 'static-style-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: ONE_DAY_IN_SECONDS,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  {
    // Documents, RSC payloads, Server Action responses and API reads reach the
    // network or they fail. Keeping this last and unconditional is what makes
    // the list above exhaustive. It also consumes the navigation preload
    // response, so enabling `navigationPreload` does not cost a second request.
    matcher: /.*/iu,
    method: 'GET',
    handler: new NetworkOnly(),
  },
];

/**
 * Caches the build's static assets so a precached page loads without a network.
 *
 * It caches assets and nothing else. Content stays in IndexedDB and on the
 * server: two caches over the same data drift, and the one nobody thought
 * about wins.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();
