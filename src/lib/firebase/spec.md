# lib/firebase — current behavior

## What this module does

Reports usage to Google Analytics 4 and reads feature flags from Firebase
Remote Config. Both run in the browser; there is no server tier.

## Behavior

- Every file starts with `import 'client-only'`, so pulling one into a server
  render is a build error rather than a runtime crash on `indexedDB is not
  defined`.
- `provider.tsx` is rendered once, from `src/app/[locale]/layout.tsx`. It starts
  both SDKs after mount and publishes the flag snapshot through React context.
- Nothing starts unless all four `NEXT_PUBLIC_FIREBASE_*` variables are set. A
  checkout with no Firebase project builds, runs, reports nothing, and reads
  every flag from its in-repo default.
- `isSupported()` gates Analytics. It answers false in an extension page, with
  cookies disabled, without IndexedDB, and when IndexedDB exists but will not
  open — which is a Firefox private window and a locked-down Safari profile.
- A failed Remote Config fetch is swallowed and the defaults stand. A flag
  service outage is not a page outage.
- Events are dropped, never queued, when Analytics is not running. The service
  worker's allow-list ends in `NetworkOnly`, so nothing buffers them offline
  either; `src/lib/offline-queue` carries this app's own writes, not telemetry.

## Consent, and what it currently costs

**Analytics storage consent defaults to `denied`, and nothing can grant it yet.**
`setConsent` runs before `getAnalytics` so the value is gtag's *default* rather
than an update — the difference is whether a cookie is written before the user
was asked. There is no consent banner in this app, and `src/lib/config.ts`
declares an `fr` locale, so the `_ga` cookies GA4 would write are non-essential
storage requiring prior opt-in.

Two consequences worth knowing before reading any dashboard:

- GA4 models cookieless pings rather than measuring them. Early numbers are
  directional, not counts.
- Remote Config's audience and user-property targeting has nothing to target
  on. Percentage rollouts and targeting on installation, app version, platform,
  browser and country still work.

`grantAnalyticsConsent()` exists and is called by nothing. It is the single
place a future banner hooks into.

## Flags

`flag-keys.ts` declares every flag and its default, and imports no SDK. An
undeclared name is a type error at the call site.

**The default is the contract.** Remote Config cannot answer during server
rendering, before the first fetch resolves, offline, behind a blocked origin, or
without a project — all of which render the default. A default that is not the
safe value is an incident waiting for a network blip.

A change propagates in at most 12 hours in production, which is Remote Config's
own cache lifetime and therefore the real latency of a flag flip. Development
refetches every minute. Neither is a kill switch.

Flags evaluate in the browser after mount, so **the first paint always shows
defaults** and a differing flag visibly changes. Evaluating on the server would
remove the flicker and was rejected — see `decisions.md`.

Nothing reads a flag yet. The first feature that needs one is where a call site
earns its place.

## Where the data lives

Google's servers, and three vendor-owned IndexedDB databases plus GA4's cookies
in the browser. `src/lib/local-db/spec.md` names the databases and explains why
the Firebase Installation ID is a known gap: it is durable, server-registered,
and Clerk sign-out does not clear it.

## Third-party origins

Seven origins were added to the CSP in `next.config.ts` for this module:

- `https://www.googletagmanager.com` on `script-src` — the SDK injects the
  gtag.js `<script>` at runtime. It cannot be proxied: the URL is a hardcoded
  constant in the shipped bundle, unlike Sentry, which this app tunnels.
- `https://www.googletagmanager.com`, `https://*.google-analytics.com` on
  `img-src` — gtag's pixel-beacon fallback.
- `https://*.google-analytics.com`, `https://*.analytics.google.com`,
  `https://www.googletagmanager.com` on `connect-src` — `/g/collect` and its
  regional variants, and gtag's own config call.
- `https://firebaseinstallations.googleapis.com` on `connect-src` — installation
  registration. Neither product starts without it, and it is the origin most
  often forgotten.
- `https://firebaseremoteconfig.googleapis.com` on `connect-src` — the config
  fetch.
- `https://firebase.googleapis.com` on `connect-src` — the dynamic web config
  (`/v1alpha/projects/-/apps/<appId>/webConfig`). Analytics requests this on
  startup **even when `measurementId` is set locally**; it is how the SDK gets
  the authoritative id, and the local value is the fallback. This was found by
  watching the requests a real browser makes, not by reading the docs, which
  describe it as the fallback for a missing id.

No `unsafe-` directive was added. The policy ships report-only, so a missing
origin here is silent until it is enforced.

## Access

None, and none possible. Everything this module holds is readable by any script
on the origin and by anyone at that machine.

## Out of scope

Server-side flag evaluation, Firebase Auth, Firestore, Storage, and Messaging.
Analytics has no server tier here: GA4's Measurement Protocol is a different
product with its own secret.
