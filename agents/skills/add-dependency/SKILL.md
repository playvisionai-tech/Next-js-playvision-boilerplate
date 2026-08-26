---
name: add-dependency
description: Add a package to this Next.js app. Use when a task needs something not in package.json, when a new env var or CSP origin is required, or when the user asks whether a library can be added. Covers the ask-first gate, where the package may be imported, wrapping it, env and CSP, verification, docs, and rollback.
---

# Adding a dependency

`AGENTS.md` gates this — "Ask first: adding a dependency" — but gives no
procedure. This is the procedure.

One `pnpm add` here usually trips three more ask-first gates: `env.ts`, the CSP
in `next.config.ts`, and `allowBuilds`. Each fails in a different place, and one
of them does not fail at all until the policy flips to enforcing. Work in order.

## 1. Propose once, naming every gate it trips

Do **not** install before approval. `pnpm add` rewrites `pnpm-lock.yaml`, and a
half-reverted lockfile is the most common way this goes wrong.

The proposal says:

1. **Package and exact version**, and what it replaces — or "nothing, this is
   new surface".
2. **Which layer it lands in.** Step 3's table decides that, not where it
   happens to be needed first.
3. **The other ask-first gates it trips**, listed up front:
   - a new env var → `src/lib/env.ts`
   - loads a script, opens a socket, or pulls an image from a third-party
     origin → an origin in `next.config.ts`
   - an install script → `allowBuilds` in `pnpm-workspace.yaml`
   - persists anything in the browser → a storage-tier decision
4. **Client bundle cost**, if it ships to the browser. A server-only package
   costs visitors nothing; a client one costs every visitor on every load.
5. **Alternatives**, including doing nothing and writing it in-repo. This is the
   raw material for `decisions.md`. If there is no honest alternative, say so
   and skip `decisions.md` rather than padding it.
6. **Maintenance signal**: last publish, open issues, and whether it actually
   supports React 19 and the App Router — a package that has not shipped since
   the Pages Router is a rewrite wearing a version number.

One proposal covering every gate. Approving the package and then discovering it
needs a CSP origin is two conversations where one would have done.

## 2. Install

```bash
pnpm add <pkg>       # runtime
pnpm add -D <pkg>    # tooling
```

Never hand-edit `package.json`. pnpm is pinned by `packageManager`; Node is
`>=24`.

**`Ignored build scripts`** means the package wants to run a postinstall. That
is the mechanism working, not failing. Read what the script does, then add one
entry to `allowBuilds` in `pnpm-workspace.yaml` — that file's header asks you to
have decided the script is safe, so decide it.

Confirm `pnpm-lock.yaml` changed in the same commit.

## 3. Decide where it may be imported

| The package touches | It lives in | First line |
|---|---|---|
| the database, a secret, an API key | `src/features/<f>/server/` | `import 'server-only';` |
| `indexedDB`, `window`, `localStorage` | `src/features/<f>/local/` | `import 'client-only';` |
| infra two or more features need | `src/lib/<name>/` | — (owes `spec.md`) |
| infra one feature needs | that slice | — |
| something the user sees, one feature | `src/features/<f>/components/` | — |
| something the user sees, 2+ features | `src/components/ui/<name>.tsx` | — (owes an inventory row) |

**A UI wrapper does not start in `components/ui`.** The promotion rule in
`components/ui/spec.md` is 2+ features *and* no feature-specific logic, and it
applies to a wrapper exactly as it applies to a component you wrote yourself.
A first-use wrapper lives in the slice even when a second caller looks certain —
two similar wrappers are cheaper to unpick than one wrong abstraction. Read
`agents/skills/new-ui-primitive/SKILL.md` before promoting one.

Two directions are enforced and will fail `check:boundaries`: `src/lib` may not
import from `src/features`, and no feature may import another.

## 4. Wrap it — one import site

**A third-party package gets exactly one import site in `src/`.** Everything
else imports the wrapper. This is the difference between swapping a library in
an afternoon and swapping it across forty files.

A wrapper is not a pass-through. Re-exporting the library unchanged buys
nothing. It must do at least one of: narrow the surface to what this app uses,
apply house defaults so call sites cannot get them wrong, adapt the library to
our conventions (`cn()` for classes, keys from `src/messages`, `Link` from
`lib/i18n/navigation`), or isolate the swap to one file.

**No barrel file** — not even in `components/ui`. Each primitive is imported
from its own path; `components/ui/spec.md` says why.

Prove it:

```bash
grep -rn "<package-name>" src/ | grep -v <wrapper-path>
```

Nothing should come back. If it cannot, say why in `decisions.md`.

Skip the wrapper for build-time and config-only packages, type-only
dependencies, and a provider mounted once in `[locale]/layout.tsx`. When you
skip it, write the line in `decisions.md` anyway — otherwise "no wrapper" is
indistinguishable from "forgot".

## 5. Env vars

Every variable goes through `src/lib/env.ts`. Never `process.env` directly.

- t3-env needs the variable in **two** places: the `server`/`client` block *and*
  `runtimeEnv`. One without the other type-checks and then fails at runtime.
- Browser-readable needs the `NEXT_PUBLIC_` prefix, and that prefix is a
  decision, not a formality — the value ships to every visitor. A secret never
  gets it.
- An optional third-party key is `.optional()` **plus a named boolean gate** in
  the module that consumes it; `src/lib/observability/logger.ts` is the pattern.
  `.optional()` on its own leaves an orphan — `NEXT_PUBLIC_POSTHOG_KEY` has been
  declared, and read by nothing, since the day it was added.

## 6. CSP, if it talks to a third party

Add the **specific origin** in `next.config.ts`, to the directive that actually
needs it: `script-src` for a loaded script, `connect-src` for fetch, XHR,
WebSocket or beacon, `img-src` for a pixel, `frame-src` for an embed.

Never `*`, never a new `unsafe-`. Widening the policy to make an error go away
is what that file's header forbids.

**The trap:** the header ships as `Content-Security-Policy-Report-Only`. A
missing origin breaks nothing — it prints a console violation nobody sees, and
then breaks on the day the policy flips to enforcing. Load the page, open the
console, and confirm zero violations before calling it done.

Say why the origin was added in the `spec.md` of the module that needs it.

## 7. Verify

```bash
pnpm verify
```

The whole chain, not a subset. Failures that mean something specific:

- **Knip flags the new package as unused** — it is declared but not imported
  yet. Install and import in the same change. If it genuinely has no static
  import because it resolves by name at runtime, add it to `ignoreDependencies`
  in `knip.config.ts` with the reason, as `@swc/helpers` does.
- Knip runs with `treatConfigHintsAsErrors: true`, so a stale ignore entry is
  itself a failure.
- **A phantom dependency error** — pnpm's strict `node_modules` refusing an
  import nothing declared. Declare it; do not hoist around it.
- **It passes everything and fails in `build-local`** — that is the
  server/client boundary. A client-only package reached a Server Component, or a
  wrapper is missing `'use client'`.
- **Refs or proxies misbehave in production only** — `reactCompiler` is on for
  production builds only. `'use no memo'` is the opt-out;
  `src/features/example/components/note-form.tsx` uses it for react-hook-form.
- **Ultracite suddenly demands Prettier** — something created an
  `eslint.config.mjs`. The boundary config is deliberately named
  `eslint.boundaries.config.mjs`. Keep it that way.

The wrapper gets a test in the `__tests__/` folder beside it. Browser APIs → a
`.test.tsx` so it runs in the `ui` project; node-only → `.test.ts`. Confirm it
appears in the run output — a test outside `__tests__/` does not run, and
silence looks like success.

## 8. Document

- `check:specs` fails a changed feature or lib module whose `spec.md` did not
  change in the same set. A new `src/lib/<name>/` owes a `spec.md` before the
  check will pass.
- Anything landing in `components/ui` gets a row in the inventory, **including
  the server-safe column**.
- `decisions.md` only for a genuine fork — chose A over B for a reason someone
  could question later. Date it, and put it where the code it constrains lives.
  A package nobody would argue about does not need one.
- A new feature slice needs its zone in `eslint.boundaries.config.mjs`. That one
  fails open: nothing will tell you.

## 9. Rollback

Agree the trigger *before* starting. The expensive failure is a half-removed
dependency.

```bash
pnpm remove <pkg>    # never hand-edit package.json
```

Then unwind by hand, in this order: the import sites, the wrapper, the CSP
origin, **both** `env.ts` entries, the `allowBuilds` line, any `knip.config.ts`
entry. Confirm `pnpm-lock.yaml` returned to its previous state, then run
`pnpm verify`.
