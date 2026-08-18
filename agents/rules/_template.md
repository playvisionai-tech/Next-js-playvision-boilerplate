---
title: Rule Title Here
impact: CRITICAL | HIGH | MEDIUM | LOW
impactDescription: What this prevents, in a clause
paths:
  - 'src/**/*.ts'
tags: tag1, tag2
---

## Rule Title Here

**Impact: LEVEL (what it prevents)**

Two or three sentences: the rule, and the failure it exists to stop. Not the
principle behind it — the specific thing that goes wrong without it.

**Incorrect (what is wrong about it):**

```tsx
// the mistake, written the way it actually appears in a diff
```

**Correct (what is right about it):**

```tsx
// the smallest real example
```

**Tripwire:** A check someone can apply while reading a diff, without running
anything.

**Enforced by:** bundler | ESLint | Vitest | CI | review only

Reference: [link](https://example.com)
