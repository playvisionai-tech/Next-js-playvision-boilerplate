# lib/firebase — decisions

## 2026-08-26 — Firebase for both flags and analytics, over PostHog

Three options were investigated against this repo's rules before anything was
installed.

**Rejected: nothing, with flags written in-repo.** A percentage rollout is a
stable hash of an identifier against a threshold — roughly forty lines, no
vendor, no CSP origin, no bundle. It remains the right answer for a project that
wants flags and not analytics. It was rejected because analytics was wanted too,
and that is not forty lines.

**Rejected: PostHog.** One SDK covers both jobs, offers genuine server-side flag
evaluation, and `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` were
already declared in `src/lib/env.ts` — declared and read by nothing, which is
how they were found. It costs ~85 KB gzipped on every visitor and autocaptures
by default. Rejected by product decision, not on the technical comparison.

**Chosen: `firebase`, client SDK, both products.** The two share
`@firebase/app`, `util` and `installations` — about 36 KB of the total — so the
second product costs ~12-21 KB marginal rather than another 40. Analytics is
also what unlocks Remote Config's audience targeting, which a flags-only
integration cannot use at all.

The orphaned PostHog variables were left in place; removing them is a separate
change.

## 2026-08-26 — Flags evaluate in the browser, not on the server

`firebase-admin` can evaluate Remote Config server-side, which would remove the
first-paint flicker entirely and cost zero bundle. It was rejected on two
grounds.

Server templates evaluate **only** percentage conditions and custom signals.
Everything the Firebase console lets you author — country, platform, browser,
Analytics audiences, user properties — is client-template-only, so the server
path would have discarded the targeting that motivated taking Analytics.

It also carries an open Next.js defect: with `output: 'standalone'` and a
Turbopack build, `serverExternalPackages` are omitted from the traced
`node_modules` (vercel/next.js#88844). `pnpm build-local` compiles the app but
never boots the standalone artifact, so the whole verification chain can pass
while the deployable image is missing the package.

The cost accepted is the flicker: the first paint shows defaults. Anything where
that flicker is unacceptable does not belong behind a client-evaluated flag.

## 2026-08-26 — Both new install scripts stay blocked

`pnpm add firebase` surfaced two transitive postinstall scripts and asked for a
decision on each. Both were read, and both are no-ops here:

- `@firebase/util` reads `FIREBASE_WEBAPP_CONFIG` and returns immediately when
  it is unset. That variable is Firebase App Hosting's config injection; this
  app does not deploy there.
- `protobufjs` returns immediately unless the package sets `versionScheme`, and
  at most prints a version-mismatch warning to stderr. It writes no files.

Both are recorded as `false` in `pnpm-workspace.yaml` rather than deleted. A
missing entry makes the next `pnpm add` ask the question again; an explicit
`false` records that it was answered.

## 2026-08-26 — Only four environment variables, not seven

`initializeApp` accepts `authDomain`, `storageBucket` and `messagingSenderId`,
and the Firebase console hands you all seven together. They were left out.
Nothing here uses Auth, Storage or Messaging, and an `.optional()` variable that
nothing reads is exactly the orphan that made the PostHog keys a finding rather
than a feature. They go in when a product needs them.

`measurementId` is required despite being optional to the SDK, because omitting
it leaves the app dependent on a network fetch for its own identity.

That reasoning originally claimed setting it would avoid a call to
`firebase.googleapis.com` and therefore one CSP origin. Running the app in a
real browser disproved it: Analytics requests `webConfig` from that origin on
startup regardless, and the local `measurementId` is only the fallback when the
fetch fails. The origin is in the policy because the SDK asks for it, not
because the id is missing.
