# Portfolio — current behavior

## What this feature does

A static list of demo portfolio entries and a detail page for each. It is the
counterpart to the counter slice: the same structure with no server tier at
all, which is what most content features look like.

## Behavior

- The list renders `PORTFOLIO_ITEM_COUNT` entries, each linking to its detail
  page through the locale-aware `Link`.
- Detail pages exist only for the generated slugs. `dynamicParams = false`
  means an unknown slug is a 404 rather than an on-demand render.

## Entry points

- Routes: `src/app/[locale]/(marketing)/portfolio/page.tsx` → `portfolio-view.tsx`
  and `.../portfolio/[slug]/page.tsx` → `portfolio-detail-view.tsx`
- Shared: `constants.ts` — `PORTFOLIO_ITEM_COUNT`, imported by both the view and
  `generateStaticParams`

## Where the data lives

Nowhere. The entries are generated from a count constant. There is no `server/`
folder and no database access, which is why this slice has no `decisions.md`:
nothing here was a fork in the road.

## Access

Public.

## Out of scope

Real content. When entries come from a CMS or a database, this slice grows a
`server/queries.ts` and the static generation strategy becomes a real decision
worth recording.
