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

/**
 * Prefix serwist derives for the default locale's prerendered pages.
 *
 * Precache keys come from build output filenames, so English pages land under
 * `/en/*`. With next-intl's `localePrefix: 'as-needed'` the app actually serves
 * them at `/`, `/about` — so those URLs matched no key and every
 * English route failed offline while French worked.
 *
 * This runs here rather than in a `manifestTransforms` entry because user
 * transforms run BEFORE `@serwist/next`'s own, and it is that transform which
 * turns `.next/server/app/en/about.html` into `/en/about` in the first place.
 */
const DEFAULT_LOCALE_PREFIX = '/en';

/**
 * Rewrites default-locale precache keys to the URLs the app serves.
 *
 * @param entries The injected precache manifest.
 * @returns The manifest with `/en` and `/en/x` rewritten to `/` and `/x`.
 */
function stripDefaultLocale(entries: (PrecacheEntry | string)[]) {
  return entries.map((entry) => {
    const url = typeof entry === 'string' ? entry : entry.url;

    if (url !== DEFAULT_LOCALE_PREFIX && !url.startsWith(`${DEFAULT_LOCALE_PREFIX}/`)) {
      return entry;
    }

    const rewritten = url === DEFAULT_LOCALE_PREFIX ? '/' : url.slice(DEFAULT_LOCALE_PREFIX.length);

    return typeof entry === 'string' ? rewritten : { ...entry, url: rewritten };
  });
}

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
  precacheEntries: stripDefaultLocale(self.__SW_MANIFEST ?? []),
  precacheOptions: {
    plugins: [
      {
        // Precache fetches are same-origin and credentialed by default. The
        // prerendered /fr pages respond with Set-Cookie: NEXT_LOCALE=fr, so
        // precaching them silently switched an English user to French on their
        // next navigation. Dropping credentials stops the worker writing cookies.
        requestWillFetch: async ({ request }) =>
          await Promise.resolve(new Request(request.url, { credentials: 'omit' })),
      },
    ],
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();
