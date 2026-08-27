# UI kit — decisions

## 2026-08-20 — Error boundaries sit inside the route group that renders the chrome

**Chose:** `error.tsx` in `(marketing)/` and in `(auth)/dashboard/`, with the
one at `[locale]/` kept as a last resort.
**Over:** the single boundary at `[locale]/error.tsx` this app shipped with.
**Why:** an error boundary renders inside its *parent* layout but replaces its
own segment's children — nested layouts included. `[locale]/error.tsx` sits
above `(marketing)/layout.tsx`, which is the file that renders `BaseTemplate`,
so every caught error took the header, nav and footer down with it and left the
user on a dead-end page with no way to navigate. Measured against `pnpm dev`
with a route that throws on its first server render: `header nav` count was 0
and there was no `main` landmark at all while the boundary showed, in both `en`
and `fr`. With the boundary moved into the group, the same probe reports
`header nav` = 2 and the error state rendered inside `main`.

`(auth)` needed the boundary one segment lower than `(marketing)` did.
`BaseTemplate` there is rendered by `dashboard/layout.tsx`, not by
`(auth)/layout.tsx`, so a boundary at the group root would have been above the
chrome again and changed nothing. The rule is not "put it in the route group" —
it is "put it below every layout whose output you want to survive".

**Kept the `[locale]/` boundary anyway**, because the group boundaries
structurally cannot catch three things: a throw from `(marketing)/layout.tsx` or
`(auth)/layout.tsx` themselves (a layout's own error is caught by the boundary
in the *parent* segment), a throw from `(auth)/(center)/`, and a throw from
`[...rest]`, which belongs to no group. Deleting it would send all three to
`global-error.tsx`, which replaces the entire document — strictly worse than
losing the chrome. It does lose the chrome, and that is correct: it is the
boundary that still works when the layout drawing the chrome is what failed.
Verified with a probe route directly under `[locale]/`: the boundary rendered,
`header nav` was 0 as expected, and the retry recovered.

**Trade-off:** three boundary files instead of one, and a reader has to know
which one catches what. The JSDoc in each says so, and all three delegate to a
single `RouteError`, so there is one copy of the behaviour.
**Revisit when:** `(auth)/(center)/` grows real chrome. It would then want its
own boundary too.

## 2026-08-20 — Retry is `router.refresh()` and `reset()` in one transition

**Chose:** `startTransition(() => { router.refresh(); reset(); })`, with
`useRouter` from `@/lib/i18n/navigation`.
**Over:** passing Next's `reset` straight to the button, which is what the
boundary did and what the API's name invites.
**Why:** `reset()` only re-renders the boundary's subtree from the RSC payload
the client already holds — and for a server render error that payload *is* the
failure. The children throw again on the same tick, so the button re-renders the
same error state and looks broken. Recovering needs a new payload, which is
`router.refresh()`. Measured: before the change, clicking "Try again" on a route
that throws on its first server render left `data-testid="error-state"` on
screen in both `en` and `fr` and the recovered content never appeared; after,
both locales render the recovered page.

The two calls must share one `startTransition`. Separately, `reset()` re-renders
the children against the stale payload before the refresh resolves, which throws
again and puts the boundary back — the refresh then lands on a boundary that has
already re-entered its error state. In one transition React holds the current UI
until the refetched tree is ready and swaps once.

`useRouter` comes from `@/lib/i18n/navigation`, not `next/navigation`. The
next-intl wrapper spreads the underlying router, so `refresh` is the same
function, but importing the locale-aware module is what keeps the boundary from
becoming the one place that drops the locale if it ever needs `push`.

**Trade-off:** a client-side render error now also triggers a needless RSC
refetch. That path recovered on `reset()` alone before and still does — verified
— so the cost is one request on a path that was already failing.
**Revisit when:** Next.js makes `reset()` refetch on its own. The workaround is
then dead weight.

## 2026-08-20 — There is no permanent end-to-end test for the boundary

**Chose:** proving both fixes with a throwaway route driven by Playwright, then
deleting it; permanent coverage is the unit test in
`__tests__/route-error.test.tsx`, which asserts that one click calls both
`refresh` and `reset`.
**Over:** keeping a route that throws on demand so `e2e/` could cover it.
**Why:** a permanently reachable failing route is a real route — it ships, it is
crawlable, and it is one bad guard away from being a way to trigger errors in
production.
**Trade-off:** the *placement* of the boundary files has no automated guard. If
someone moves `BaseTemplate` to a different layout, or adds a route group
without a boundary, the chrome silently starts disappearing again and only a
manual check would notice.

## 2026-08-27 — The a11y gate is armed, and covers seven primitives rather than all thirteen

**Chose:** `parameters.a11y.test = 'error'` in `.storybook/preview.ts`, plus a
story for each primitive whose accessibility is load-bearing — `Button`,
`Input` (with `Label`), `Select`, `Dialog`, `ErrorState`, `LocaleSwitcher`, and
the `BaseTemplate` story that already existed. `Card`, `Separator`, `Skeleton`
and `EmptyState` get no story, and the inventory's "a11y gate" column says so
per row.
**Over:** two alternatives. **Arm it and write all twelve missing stories** —
which buys nothing for the four primitives that are styled `div`s with no name,
role or relationship, and a story that can only ever pass is worse than no story
because the column then reads as coverage. **Arm it and delete the `storybook`
CI job** — cheap and honest, but it throws away the only component-level
accessibility signal the repo has, on the day it first became capable of
producing one.
**Why:** axe reads a rendered tree. It can only catch a regression in a
primitive that owns an accessible name, a role, an ARIA relationship, or a
colour pair. That set is a property of the primitives, not a matter of effort,
so it is what the covered set is drawn from — and it is written down rather than
implied, so the next primitive knows which side it falls on.

Arming it was not a formality: it failed immediately, on three real violations
that had been present and unreported. The footer link in `BaseTemplate` was
distinguished from the surrounding text by colour alone at 1.5:1
(`link-in-text-block`); `ErrorState`'s description was `text-red-600` on
`bg-red-50` at 4.36:1; and `Button`'s `destructive` variant put
`text-destructive` on its own 10% tint at 4.0:1. All three are fixed in the
primitives. None was exempted.

**Trade-off:** the gate now runs axe on portalled content only because the
`Dialog` and `Select` stories set `parameters.a11y.context` to `'body'`. A
future portalled primitive whose story omits that gets a green run over an empty
canvas — coverage that reads as real and is not. The inventory says this; nothing
enforces it.
**Revisit when:** a primitive is added that owns a name, role or colour pair and
is not given a story. The column is the review gate, and a column is only as
good as the reviewer reading it.
