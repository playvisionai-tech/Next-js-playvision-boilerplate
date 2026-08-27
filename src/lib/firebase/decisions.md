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
change. **Superseded 2026-08-27 — that change was made; see the entry at the
bottom of this file.**

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

## 2026-08-27 — The orphaned PostHog variables are deleted, and the lesson is not

**Chose:** delete `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` from
`src/lib/env.ts` and `.env`, and keep every reference to them that is history
rather than instruction.
**Over:** deleting every mention, so that a grep for the name returns nothing.

**Why:** this discharges the closing paragraph of the first entry above. Nothing
read either variable; no PostHog package is installed and none is planned, since
that entry rejected PostHog. `README.md` also advertised "Analytics with
PostHog", which was never true of this repository and is now replaced by what
actually ships.

The references divide cleanly, and the line is between a claim about the present
and a record of the past:

- **Declarations go.** `src/lib/env.ts` and `.env`. These were the orphan.
- **A live instruction that asserts a present fact changes.**
  `agents/skills/add-dependency/SKILL.md` §5 said the key "has been declared, and
  read by nothing, since the day it was added". True when written, false the
  moment the variable left. It now states the same lesson in the past tense and
  points here.
- **History stays.** This file and `src/lib/api/decisions.md` describe what was
  decided and why, and `decisions.md` is append-only. Erasing the example to
  make a grep come back clean would delete the only surviving evidence for a
  rule two modules already cite.
- **`src/lib/firebase/app.ts` is untouched.** Its comment reads "would leave the
  same orphan `NEXT_PUBLIC_POSTHOG_KEY` was" — already past tense, still true,
  and sitting at the exact line where someone could repeat the mistake. Editing
  it would be a code change to `src/lib/firebase/`, which `check-specs` answers
  by demanding a rewrite of this module's `spec.md` — a spec rewrite for a module
  whose behaviour did not change is the padding `docs-keep-spec-current.md`
  exists to prevent.

**Trade-off:** `grep -rn NEXT_PUBLIC_POSTHOG src agents` still returns hits, in
four files — this one, `src/lib/api/decisions.md`, `src/lib/firebase/app.ts` and
the skill. That is the intended result, not an incomplete deletion. Every one of
them is a dated record or a past-tense comment; none declares anything, and none
can be satisfied by a value in an environment. What is gone is the only kind of
mention that could be: the declaration. `README.md` keeps PostHog's sponsor logo,
which is an acknowledgement and not a claim about this codebase.
