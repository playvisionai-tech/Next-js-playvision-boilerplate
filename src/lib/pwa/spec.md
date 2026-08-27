# lib/pwa — current behavior

## What this module does

Two things: it serves the web app manifest that describes the app to the
operating system, and it registers the service worker that makes the app load
without a network.

**The app is not installable on Chrome, Edge or Android today.** The manifest is
valid and complete except for its icons, and the icons are the part those
browsers gate the install prompt on. Read "Installability" below before assuming
otherwise.

## The manifest

`manifest.ts` builds the web app manifest. `src/app/manifest.ts` is a four-line
route that returns it, so Next serves it at **`/manifest.webmanifest`** with
`Content-Type: application/manifest+json`, and injects
`<link rel="manifest" href="/manifest.webmanifest">` into every document — the
route file convention does that on its own, so nothing sets
`metadata.manifest` by hand.

What it declares:

| Field | Value | Why |
|---|---|---|
| `id` | `/` | Pinned, so changing `start_url` later updates this app rather than the OS installing a second one. |
| `name`, `short_name` | `AppConfig.name` | Identity, not copy. See below. |
| `start_url`, `scope` | `/` | The locale-negotiated entry point. See below. |
| `display` | `standalone` | An install with browser chrome is not an install. |
| `background_color`, `theme_color` | `#ffffff` | Mirrors `--background` in the light theme. |
| `icons` | 180, 32, 16 px PNGs from `public/` | All `purpose: 'any'`. **Not enough for an install prompt** — see "Installability". |

**It carries no translated string.** There is one manifest for the whole origin
and it has no locale, so any message catalog it read would be one locale's copy
handed to every locale's users — and frozen at the moment they installed.
`name` and `short_name` are the product's name, which is the same in every
language; `description` and `lang` are absent rather than English. `decisions.md`
records what was rejected.

**`start_url` is `/`, never `/en`.** With `localePrefix: 'as-needed'` the
default locale has no prefix, so `/` is the only path that leaves the locale to
the app on launch instead of to the manifest at install time. The consequence is
real and is not fixed here: this app does not detect locale from headers, so a
French user launching the installed app lands on English unless their
`NEXT_LOCALE` cookie is present in the standalone context — on iOS it is a
separate storage partition, so it usually is not.

**Every icon in the manifest is a file committed to `public/`, at the size it
claims.** The test in `__tests__/manifest.test.ts` reads each PNG's IHDR header
to assert that, because a manifest that names a missing file fails inside the OS
installer, where nothing in this repository would see it. Nothing here 404s.

The manifest is **not precached**. `serwist build` walks the build output for
documents and `public/` assets; the manifest is a route, so it is not in either
set. Installation is an online act, so this costs nothing today.

## Installability

**Chrome, Edge and Android will not offer to install this app.** They require the
manifest to declare an icon at **192x192** and one at **512x512**, both
`purpose: 'any'`. `public/` holds four assets — `apple-touch-icon.png` (180x180),
`favicon-32x32.png`, `favicon-16x16.png`, `favicon.ico` — and there is no SVG or
larger source anywhere in the repository, so neither size can be declared without
naming a file that does not exist.

What is true today: the manifest is served, parses, and is linked from every
document; `display`, `id`, `start_url` and `scope` are all set correctly; every
icon it names resolves at the size it claims. The install prompt still does not
fire, and a manifest that parses cleanly is easy to mistake for one that works.

**What has to be added:** `public/icon-192x192.png` (192x192) and
`public/icon-512x512.png` (512x512), both PNG, both drawn — not upscaled from
the 180x180, which is a 2.8x blur — then added to the `icons` array in
`manifest.ts` with `purpose: 'any'`. `decisions.md` records why they were not
faked. `__tests__/manifest.test.ts` fails the moment they arrive, so the claim
above cannot rot.

**iOS is different, and does work.** "Add to Home Screen" in Safari is a manual
user action with no install criteria to meet. It takes its icon from the
`<link rel="apple-touch-icon">` tag in the locale layout — the 180x180 file —
and does not consult the manifest's icon sizes at all. It does read the
manifest's `display`, so the installed app launches standalone. So the same
build is a usable home-screen app on iOS and un-installable on Android.

No icon is declared `maskable`. That is a promise that the art survives being
cropped to a circle or a squircle, and none of these icons was drawn with that
safe zone, so declaring it would ship a clipped logo on every Android launcher.

## Safe areas

The viewport export in `src/app/[locale]/layout.tsx` sets
`viewportFit: 'cover'`, which is what makes `env(safe-area-inset-*)` resolve to
anything other than `0`. `src/styles/global.css` registers the four insets as
Tailwind spacing tokens — `--spacing-safe-top`, `-right`, `-bottom`, `-left` —
in a `@theme static` block, so they are emitted as custom properties before any
utility references them and anything pinned to an edge writes
`pb-safe-bottom` rather than an inline `env()` call.

The only thing using them today is `body`, which takes
`padding-bottom: var(--spacing-safe-bottom)` so the last line of a scrolled
document does not sit under the iOS home indicator. A bar pinned to the bottom
is out of flow and pads itself.

These two halves are one change: remove `viewportFit` and every token silently
becomes zero on every device, with nothing failing.

## Service worker registration

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

Per-locale manifests — a decision recorded in `decisions.md`.

Not out of scope, just not done: the 192x192 and 512x512 icons that Chrome, Edge
and Android require before offering an install, and a maskable icon. All three
are blocked on source art `public/` does not have. See "Installability".
