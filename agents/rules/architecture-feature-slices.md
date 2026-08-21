---
title: Features are closed; sharing goes through lib or components/ui
impact: CRITICAL
impactDescription: Keeps slices independently movable and deletable
paths:
  - 'src/features/**'
  - 'src/components/**'
  - 'src/lib/**'
tags: architecture, boundary
---

## Features are closed; sharing goes through lib or components/ui

`features/a` may not import from `features/b`. Shared layers — `components/`,
`lib/`, `types/` — may not import from `features/` or `app/`. Imports point one
way: `lib → features → app`.

One cross-feature import is harmless. The tenth means neither feature can be
moved, tested, or deleted alone, and by then unpicking them is a project rather
than a change.

**Incorrect (reaching sideways into another slice):**

```ts
// features/counter/counter-view.tsx
import { PortfolioCard } from '@/features/portfolio/components/portfolio-card';
```

**Correct (promote it, then both import down):**

```ts
// features/counter/counter-view.tsx
import { Card } from '@/components/ui/card';
```

A component earns a place in `components/ui` when 2+ features use it AND it has
no feature-specific logic. Until then it stays in the feature that owns it, even
if that means writing it twice — two similar components are cheaper to unpick
than one wrong abstraction.

**Tripwire:** Does this import path contain `features/` and start from a
different feature? Then it is wrong however it is written — the alias form and
the `../` form are the same violation.

**Enforced by:** ESLint (`import/no-restricted-paths`), including relative
escapes. Each feature needs its own zone in `eslint.boundaries.config.mjs`; a
missing zone fails open, which is why `new-feature` writes it.
