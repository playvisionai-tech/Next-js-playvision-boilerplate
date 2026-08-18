---
title: Verify in a fixed order, cheapest signal first
impact: HIGH
impactDescription: Surfaces the real failure instead of its downstream noise
tags: ci, workflow
---

## Verify in a fixed order, cheapest signal first

```
pnpm check:types → pnpm lint → pnpm check:boundaries → pnpm test → pnpm build-local → pnpm test:e2e
```

Types first because a type error makes every later failure noise. Build before
E2E because that is where a server/client boundary violation surfaces, and a
broken build fails E2E in a way that looks like a test problem.

`pnpm verify` runs the whole chain. Running a subset and reporting "tests pass"
is how a boundary violation reaches review.

**Incorrect:**

```bash
pnpm test        # and calling it done
```

**Correct:**

```bash
pnpm verify
```

Two failures worth recognising rather than debugging:

- **`Cannot find module '../../../src/app/api/.../route.js'`** in
  `.next/dev/types` — stale generated route types after deleting a route.
  `rm -rf .next/dev .next/types && pnpm exec next typegen`.
- **A phantom dependency error** after adding an import — pnpm's strict
  `node_modules` refusing something that was never declared. Declare it; do not
  work around it.

**Tripwire:** A claim that something passes, where the command that would have
proved it was not run.

**Enforced by:** CI runs the same order. Locally it is convention.
