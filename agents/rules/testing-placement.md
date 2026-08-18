---
title: Tests live in a flat __tests__ folder beside their subject
impact: HIGH
impactDescription: Stops the test tree drifting out of sync with the source tree
paths:
  - 'src/**/__tests__/**'
  - '__tests__/**'
tags: testing, structure
---

## Tests live in a flat __tests__ folder beside their subject

Every directory whose files have testable behavior gets a `__tests__/` folder
holding the tests for **that directory's files only**. It is flat: never a
subdirectory inside it, never a test for a file that lives deeper.

A `__tests__/` at a feature root that mirrors the feature's subdirectories is a
parallel tree. Every rename then has to happen twice, and the two trees fall out
of sync silently.

**Incorrect (a mirrored tree):**

```
features/things/__tests__/components/thing-card.test.tsx
```

**Correct (one hop from the subject):**

```
features/things/components/__tests__/thing-card.test.tsx
```

Directories with nothing to test get no `__tests__/`: `src/app/`,
`src/messages/`, `src/types/`. Never create an empty one to satisfy the pattern —
an empty test folder reads as "covered".

The root `__tests__/` is the one exception, for whole-app tests only: smoke,
cross-feature journeys, and repo-wide contracts. **If a test there names one
module in its describe block, it belongs in that module's directory.**

**Tripwire:** A folder inside a `__tests__/` directory. Also: a new test file
that did not appear in the run output — it is outside the include patterns and
did not execute.

**Enforced by:** Vitest — `include` only matches `__tests__/`, so a misplaced
test does not run. Flatness and the root-folder scope are review only.
