---
title: Verify in a fixed order, cheapest signal first
impact: HIGH
impactDescription: Surfaces the real failure instead of its downstream noise
tags: ci, workflow
---

## Verify in a fixed order, cheapest signal first

```
pnpm check:types → pnpm lint → pnpm check:boundaries → pnpm check:deps →
pnpm check:i18n → pnpm check:specs → pnpm check:links → pnpm test →
pnpm build-local
```

Types first because a type error makes every later failure noise. Build last
because it is the slowest link and the one that surfaces a server/client
boundary violation — there is no point paying for it until the cheap checks
have had their say.

`pnpm verify` runs exactly that chain. `pnpm test:e2e` is **not** part of it —
Playwright needs browsers installed and a server to start, so it stays a
separate command that CI runs as its own job. Running a subset and reporting
"tests pass" is how a boundary violation reaches review.

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

**Enforced by:** Locally, `pnpm verify` — it is the order above, and it stops
at the first failure. CI does **not** reproduce it: there is no `check:types`
step at all (type checking rides inside `pnpm lint --type-check`), and the work
is split across parallel jobs — `static`, `unit`, `build`, `storybook`, `e2e` —
with no ordering between them beyond `e2e` needing `build`. CI also runs four
shell guards and `storybook:test` that `verify` does not. Green CI and a green
`pnpm verify` are overlapping claims, not the same claim.
