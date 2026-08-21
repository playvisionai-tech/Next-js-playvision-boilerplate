# UI kit — inventory

Before building any UI, check this list. If something here fits, use it.
Do not create a new primitive without checking the promotion rule below.

| Component | Use for | Server-safe? | Don't use for |
|---|---|---|---|
| `Button` | All actions | **Yes** | Navigation → `Link` from `lib/i18n/navigation` |
| `Input` | Single-line text entry | **Yes** | Anything needing a label → pair with `Label` |
| `Card` | Content containers | **Yes** | Interactive surfaces → compose with `Button` |
| `Label` | Labelling a form control | No — `'use client'` | Static text → a plain element |
| `Select` | Choosing one of a known set | No — `'use client'` | Free text → `Input` |
| `Dialog` | Modal flows | No — `'use client'` | Full-screen → push a route |
| `Separator` | Visual division | No — `'use client'` | Spacing → margin utilities |
| `Skeleton` | Suspense fallbacks | **Yes** | Empty results → `EmptyState` |
| `EmptyState` | Zero-result and first-run states | **Yes** | Failures → `ErrorState` |
| `ErrorState` | Recoverable failures with a retry | No — `'use client'` | Unrecoverable states → `EmptyState` |
| `RouteError` | The body of an `error.tsx` boundary | No — `'use client'` | Failures inside a page → `ErrorState` |
| `BaseTemplate` | The page shell: header, nav slots, footer | **Yes** | Anything inside a page body |
| `LocaleSwitcher` | Changing locale | No — `'use client'` | Anything else |

## Server-safe column

"Yes" means the component can render inside a Server Component. "No" means it
carries `'use client'`, so importing it turns the importing subtree into client
code. Prefer a server-safe primitive when both would work.

`ErrorState` is client-only for one reason: `onRetry` is an event handler. If
there is nothing to retry, render an `EmptyState` rather than an `ErrorState`
with a dead button.

## Error boundaries

`RouteError` is the whole body of every `error.tsx` in this app. Each boundary
file is a `'use client'` default export that renders it and nothing else, so the
retry behaviour is defined once. Its retry calls `router.refresh()` and
`reset()` together inside one `startTransition` — `reset()` alone cannot recover
a failed server render. See `decisions.md` for why, and for where a boundary
file has to sit.

**The column is not guessable, which is why it is written down.** `Button` and
`Input` are server-safe; `Label` and `Separator` are not. Nothing about what
those components do would tell you that — it falls out of which ones the
underlying library builds on client-side primitives. Check the row rather than
reasoning about it.

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

## Vendored primitives

The shadcn components here are vendored, not installed: they are our files now,
and they are reformatted to this project's lint rules on arrival. `shadcn add`
writes them in shadcn's own style, so expect `pnpm lint` to fail immediately
after adding one and to fix it in the same change. That is the cost of owning
the code rather than depending on it.

`components.json` records the configuration `shadcn add` uses. It resolves
`@/components/ui` and `@/lib/utils` from this repo's aliases.

**One trap:** `shadcn init` overwrites `src/lib/utils.ts` rather than appending
to it. If it runs again, check that `getBaseUrl` and `getI18nPath` survived.

## Promotion rule

A component moves here only when it is used by 2+ features AND has no
feature-specific logic. Until then it lives in that feature's `components/`.

Nothing here is a worked example of the rule yet — this template ships no
feature that shares a component. The first primitive a second feature reaches
for is the one that earns its place.
