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

## 2026-08-26 — The locale switcher replays a pre-hydration choice from the DOM

**Chose:** keeping the `<select>` uncontrolled and reading its value once on
mount, navigating if it no longer matches the active locale.
**Over:** three alternatives. Disabling the control until hydration — it hides
the problem by making the page look broken for longer, and every other
interactive control in the app would want the same treatment. Making the select
controlled with `value={locale}` — React then snaps the visible option back to
English on hydration, which is at least honest but still throws the choice away.
Waiting for hydration in the e2e test — the test was asserting something true,
and editing it would have shipped the bug.
**Why:** the server sends the switcher fully interactive before any JavaScript
arrives. A choice made in that window fires a `change` event with no listener
attached, and the browser does not replay it. The failure was permanent rather
than transient: the select is uncontrolled, so it kept displaying the language
the user picked while the page stayed in the old one, and re-picking the same
option fires no further event — the only way out was to select a third value.
Measured against a production build with `**/_next/static/**` held back for two
seconds: before the change the heading stayed "Home" with FR selected until the
15s expect timeout, matching the CI failure's accessibility snapshot exactly;
after, the page is in French. That artificial delay is what CI's container was
doing by accident, which is why the same commit was green locally and red
there.
**Trade-off:** one extra effect on every mount of the switcher, and the replay
is a navigation the user did not re-trigger — deliberate, since it is the
navigation they asked for.
**Revisit when:** the switcher becomes a form that works without JavaScript at
all. Progressive enhancement makes the replay dead code, but it needs a route
that accepts the submission, which is an ask-first change.
