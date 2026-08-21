---
title: Security headers are set once and never widened casually
impact: CRITICAL
impactDescription: The only thing standing between the page and an injected script
paths:
  - 'next.config.ts'
  - 'src/proxy.ts'
tags: security, headers, csp
---

## Security headers are set once and never widened casually

Headers live in `next.config.ts` and apply to every route. Nothing reviews a web
deploy the way an app store reviews a release; these headers are the gate.

Three things specific to this stack:

- **A strict CSP needs a nonce.** Next injects inline scripts for hydration and
  streaming. `unsafe-inline` in `script-src` is close to having no CSP at all.
- **Every third party widens the policy.** Sentry, analytics, and any embedded
  widget each need explicit origins. Add them one at a time, and say why in the
  relevant `lib/<module>/spec.md`.
- **The service worker inherits the policy.** A CSP that forbids what the worker
  needs fails only on a second visit, which is not where anyone looks.

**Incorrect (making the error go away):**

```ts
"script-src 'self' 'unsafe-inline' *"
```

**Correct (name the origin, keep the rest closed):**

```ts
"script-src 'self' 'nonce-{NONCE}' https://browser.sentry-cdn.com"
```

**Tripwire:** A diff that adds `*`, `unsafe-inline`, or `unsafe-eval` to a
directive. Any of the three needs a written reason.

**Enforced by:** CI — a request against the built app asserts the headers are
present, so a config refactor cannot drop them silently.
