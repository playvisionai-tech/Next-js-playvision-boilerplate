---
name: verify
description: Run the project's full verification chain in the correct order and interpret the failures. Use before committing, before opening a PR, when asked whether something works, or when a check fails and the cause is not obvious.
---

# Verify

```bash
pnpm verify
```

That runs, in order:

```
check:types → lint → check:boundaries → check:deps → test → build-local
```

E2E is separate because it needs browsers installed:

```bash
pnpm test:e2e
```

## Why the order

Types first: a type error makes every later failure noise. Boundaries before
tests: an illegal import is a structural problem, not a behavioral one. Build
before E2E: a server/client boundary violation surfaces at build, and if it
reaches E2E it looks like a test failure instead of what it is.

**Running a subset and reporting "tests pass" is how a boundary violation
reaches review.** If you did not run the command, do not claim its result.

## Failures worth recognising rather than debugging

**`Cannot find module '../../../src/app/api/.../route.js'`** in
`.next/dev/types` — stale generated route types after a route was deleted.

```bash
rm -rf .next/dev .next/types && pnpm exec next typegen
```

**`Cannot find module 'x' or its corresponding type declarations`** for a
package that is clearly installed — a phantom dependency. pnpm's strict
`node_modules` is refusing an import that was never declared in `package.json`.
Declare it with `pnpm add`; do not reach for a hoisting workaround.

**`Ignored build scripts`** — a new dependency wants to run an install script.
Add it to `only-built-dependencies[]` in `.npmrc` after checking what the script
does.

**Ultracite suddenly demanding Prettier or Stylelint** — something created an
`eslint.config.mjs`. Ultracite reads that filename as "this project lints with
ESLint" and swaps its whole pipeline. The boundary config is deliberately named
`eslint.boundaries.config.mjs`; keep it that way.

**A new test that did not appear in the run output** — it is outside the Vitest
`include` patterns, which only match `__tests__/` folders. It did not fail; it
did not run.
