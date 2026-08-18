# UI kit — inventory

Before building any UI, check this list. If something here fits, use it.
Do not create a new primitive without checking the promotion rule below.

| Component | Use for | Server-safe? | Don't use for |
|---|---|---|---|
| `BaseTemplate` | The page shell: header, nav slots, footer | Yes | Anything inside a page body |
| `EmptyState` | Zero-result and first-run states | Yes | Failures → `ErrorState` |
| `ErrorState` | Recoverable failures with a retry | No — `'use client'` | Unrecoverable states → `EmptyState` |
| `Skeleton` | Suspense fallbacks | Yes | Empty results → `EmptyState` |
| `LocaleSwitcher` | Changing locale | No — `'use client'` | Anything else |
| `Sponsors` | The sponsor table | Yes | — |
| `DemoBadge`, `DemoBanner` | Boilerplate demo chrome | Yes | Real product UI — delete these when the template becomes an app |

## Server-safe column

"Yes" means the component can render inside a Server Component. "No" means it
carries `'use client'`, so importing it turns the importing subtree into client
code. Prefer a server-safe primitive when both would work.

`ErrorState` is client-only for one reason: `onRetry` is an event handler. If
there is nothing to retry, render an `EmptyState` rather than an `ErrorState`
with a dead button.

## Accessibility

Keyboard handling, focus management, and labelling live here and are tested
here, so screens inherit them instead of re-implementing them. `ErrorState`
carries `role="alert"`; `Skeleton` is `aria-hidden` because a loading placeholder
is noise to a screen reader.

## Theme

Tokens come from the Tailwind config. Never hardcode a hex value or magic
spacing.

## No barrel, not even here

This kit deliberately has no `index.ts`. Import each primitive from its own file:

```ts
import { EmptyState } from '@/components/ui/empty-state';
```

A barrel here would be actively harmful rather than merely untidy. The kit mixes
server-safe components with `'use client'` ones, and re-exporting both from one
module means importing `EmptyState` pulls `ErrorState`'s client boundary in with
it — turning a server-rendered subtree into client code for no reason the
importing file can see.

## Promotion rule

A component moves here only when it is used by 2+ features AND has no
feature-specific logic. Until then it lives in that feature's `components/`.

`Sponsors` is the worked example: it is rendered by both the marketing home
view and the dashboard view, which is what earned it a place here.
