# UI kit — inventory

Before building any UI, check this list. If something here fits, use it.
Do not create a new primitive without checking the promotion rule below.

| Component | Use for | Server-safe? | a11y gate | Don't use for |
|---|---|---|---|---|
| `Button` | All actions | **Yes** | Yes | Navigation → `Link` from `lib/i18n/navigation` |
| `Input` | Single-line text entry | **Yes** | Yes | Anything needing a label → pair with `Label` |
| `Card` | Content containers | **Yes** | No | Interactive surfaces → compose with `Button` |
| `Label` | Labelling a form control | No — `'use client'` | Via `Input` | Static text → a plain element |
| `Select` | Choosing one of a known set | No — `'use client'` | Yes | Free text → `Input` |
| `Dialog` | Modal flows | No — `'use client'` | Yes | Full-screen → push a route |
| `Separator` | Visual division | No — `'use client'` | No | Spacing → margin utilities |
| `Skeleton` | Suspense fallbacks | **Yes** | No | Empty results → `EmptyState` |
| `EmptyState` | Zero-result and first-run states | **Yes** | No | Failures → `ErrorState` |
| `ErrorState` | Recoverable failures with a retry | No — `'use client'` | Yes | Unrecoverable states → `EmptyState` |
| `RouteError` | The body of an `error.tsx` boundary | No — `'use client'` | Via `ErrorState` | Failures inside a page → `ErrorState` |
| `BaseTemplate` | The page shell: header, nav slots, footer | **Yes** | Yes | Anything inside a page body |
| `LocaleSwitcher` | Changing locale | No — `'use client'` | Yes | Anything else |

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

### The a11y gate

`.storybook/preview.ts` sets `parameters.a11y.test` to `'error'`, so
`pnpm storybook:test` runs axe over every story and **fails** on a violation.
CI runs it as the `storybook` job. Before this it was `'todo'`, which reports a
violation and exits zero — the job could not fail on the thing it exists to
report.

The "a11y gate" column above says, per primitive, whether a story exists for it.
The column is deliberately not all "Yes". Axe checks a rendered tree, so a story
is only worth writing where a primitive owns something axe can read: an
accessible name, a role, an ARIA relationship, or a colour pair. Where a
primitive owns none of those, a story would pass forever and assert nothing —
coverage on paper, a liability in review.

So the covered set is the primitives whose accessibility is load-bearing:

- `Button` — an icon-only button's name is a visually hidden span (`button-name`).
- `Input` with `Label` — the `htmlFor`/`id` link is the label (`label`). This is
  also `Label`'s only coverage, and its only *possible* coverage: a label
  detached from a control has no accessibility to test.
- `Select` — the trigger's name and the portalled listbox's roles.
- `Dialog` — the accessible name comes from `DialogTitle` through
  `aria-labelledby`, and the corner close button's name is a hidden span
  (`aria-dialog-name`, `button-name`).
- `ErrorState` — `role="alert"` and the retry button, plus the red-on-red
  contrast pair.
- `LocaleSwitcher` — a bare `<select>` whose `aria-label` is its only name
  (`select-name`). `RouteError` is covered through `ErrorState`, which is its
  entire body.
- `BaseTemplate` — landmarks, the nav label, and the footer link.

Not covered, and why: `Card`, `Separator` and `Skeleton` render styled `div`s
with no name, role or relationship of their own; `EmptyState` renders text plus
whatever action node the caller passes, so what a gate would check belongs to
the caller. **A new primitive owes a story when it owns a name, a role, an ARIA
relationship, or a colour pair — and owes a row here either way.**

Two things the gate cannot see, so do not read a green run as more than it is.
It only scans what a story renders: `Dialog` and `Select` are portalled out of
the story root, so their stories set `parameters.a11y.context` to `'body'` —
without that, axe scans an empty canvas and passes whatever the popup contains.
And **axe does not evaluate focus indicators at all**, which is the subject of
the next section.

### Focus indicators are unchecked, and were failing

Nothing in this repo can catch a focus-visibility regression. axe does not look
at `:focus-visible` styling, so the a11y gate is green whatever the focus ring
does; `pnpm lint` has no view of computed colour; and the only evidence anyone
has ever had here is a number someone worked out by hand or measured in a
browser. Two failures found that way, in order:

1. **The ring computed to a transparent, zero-width shadow.** `Button` gained an
   explicit `focus-visible` outline, because an outline cannot be defeated by the
   shadow stack. That fix predates the a11y gate; its comment is at the top of
   `button.tsx`.
2. **The painted outline was still under contrast.** It is drawn in `--ring`, and
   shadcn's shipped light-mode value measured **2.58:1 against white** — under
   the 3:1 WCAG 1.4.11 requires of a non-text indicator. Fixed by darkening
   `--ring` (and `--sidebar-ring`) in `src/styles/global.css`; the comment there
   carries the ratio against each light surface. The dark value was already
   passing at 4.18:1 and is unchanged.

The second was worse than a uniform failure because it was **variant-dependent**.
A dark-filled `Button` — `default`, `secondary` — reads as focused anyway,
because its own edge against the page supplies the boundary. `ghost`, `outline`,
`link` and `destructive`, and `Input` and `SelectTrigger`, have no such edge: the
ring is the entire indicator. So the kit looked fine wherever anyone was most
likely to check it.

**One primitive passes by accident.** `LocaleSwitcher` measures around 19:1 — the
strongest focus indicator in the kit — and it gets there by *not* using the
token. Its class list is `focus-visible:ring-3` with no `ring-<color>`, so it
falls through to Tailwind's default ring colour rather than `--ring`. It was
therefore untouched by both failures above and is untouched by the fix. Left as
it is for now, because it is the one control that is currently correct, but it
is a divergence and not a design: give it `focus-visible:ring-ring/50` if the
kit is ever made uniform, and re-measure when you do.

**If you change `--ring`, `--sidebar-ring`, or any surface a control sits on,
compute the ratio.** No command will tell you.

## Theme

Tokens come from the Tailwind config. Never hardcode a hex value or magic
spacing.

`--ring` in `src/styles/global.css` is the one token with an accessibility floor
attached to it: it is the focus indicator for the whole kit and has to clear 3:1
against whatever surface a focused control sits on. See "Focus indicators are
unchecked" above before changing it.

That includes the device's safe areas. `src/styles/global.css` registers the
four insets as spacing tokens — `pt-safe-top`, `pr-safe-right`,
`pb-safe-bottom`, `pl-safe-left` — so anything pinned to an edge of the screen
uses a utility rather than an inline `env(safe-area-inset-*)`. They resolve to
zero unless the document sets `viewport-fit=cover`, which it does; see
`src/lib/pwa/spec.md`.

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
