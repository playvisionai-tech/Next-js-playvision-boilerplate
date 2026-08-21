# Dashboard — current behavior

## What this feature does

The one worked example of a route that is not public. It renders who is signed
in and nothing else, so the slice stays a demonstration of the *shape* of an
authenticated area rather than a product surface you have to unpick.

## Behavior

- Renders the signed-in user's primary email address, and a line naming where
  the protection actually comes from.
- The email line is omitted when Clerk reports no user. Clerk runs in keyless
  mode without credentials, so a local run with no keys renders the page rather
  than crashing on a missing session.

## Entry points

- Route: `src/app/[locale]/(auth)/dashboard/page.tsx` → `dashboard-view.tsx`
- Chrome: `src/app/[locale]/(auth)/dashboard/layout.tsx` owns the metadata for
  every page in the segment, and renders `BaseTemplate` with the sign-out and
  user-profile links.
- Boundary: `src/app/[locale]/(auth)/dashboard/error.tsx` sits one segment lower
  than the marketing one, because `BaseTemplate` is rendered by
  `dashboard/layout.tsx`. See `src/components/ui/decisions.md`.

## Where the data lives

Nowhere of its own. The user comes from Clerk via `currentUser()`; there is no
`server/` tier and no table.

## Access

`src/proxy.ts` matches `/dashboard(.*)` and redirects an unauthenticated request
to `/sign-in`. **That redirect is routing, not authorization.** A Server Action
is not routed through it, and a layout does not re-run on every navigation, so a
feature that owns per-user rows re-checks the session inside each of its
`server/queries.ts` and `server/mutations.ts` exports, where the row and the
session are both in scope. This slice reads no rows, so it has nothing to check.

## Out of scope

Roles, permissions, teams, and per-user data. Adding any of them here makes this
worse as a reference for where the checks belong.
