---
title: The Server Component calls the query directly
impact: HIGH
impactDescription: Avoids client waterfalls and hand-managed loading state
paths:
  - 'src/features/**'
tags: data, fetching
---

## The Server Component calls the query directly

Pick by situation, not by habit:

| Situation | Use |
|---|---|
| Data needed to render | The Server Component calls `server/queries.ts` |
| The user mutates something | Server Action in `server/mutations.ts` + `revalidateTag` |
| Changes after load without navigation — polling, infinite scroll, optimistic | TanStack Query in `api.ts` |
| A third-party API the browser must call | TanStack Query + `lib/api/client.ts` |
| Data the browser owns | Read it after mount from `local/queries.ts` |

**Row one is the default.** React Query is the exception, and reaching for it is
a decision to record in the feature's `decisions.md`.

**Incorrect (an HTTP round trip from the process to itself):**

```tsx
const res = await fetch('/api/things');
const things = await res.json();
```

**Correct (call the function):**

```tsx
const things = await getThings();
```

The same applies to mutations: a route handler that exists so your own client can
reach your own database should be a Server Action. Route handlers are for what
must be HTTP — inbound webhooks, OAuth callbacks, file streams.

**Tripwire:** A `fetch` whose URL starts with `/api/` and whose handler is in
this repo.

**Enforced by:** review only.
