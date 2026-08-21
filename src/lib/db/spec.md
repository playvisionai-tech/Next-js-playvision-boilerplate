# lib/db — current behavior

## What this module does

Owns the single Drizzle connection and the table definitions. Features import
`db` from here inside their `server/` folder; nothing else may.

## Behavior

- `client.ts` starts with `import 'server-only'`, so pulling it into a client
  component is a build error rather than a leaked connection string.
- In development and test the connection targets a PGlite server started by the
  `dev` and `build-local` scripts, so there are no credentials to configure and
  no external database to run.
- `schema.ts` is the source of truth for tables. Changing it means generating a
  migration with `pnpm db:generate`; migrations apply automatically when the
  PGlite server starts.

## Where the data lives

Postgres in production, PGlite locally. `DATABASE_URL` selects between them and
is validated in `src/lib/env.ts`.

## Access

The module enforces none. Authorization is the caller's job and belongs in each
feature's `server/queries.ts` and `server/mutations.ts`, where the row and the
session are both in scope.

## Caching

Cache Components / `use cache` is off. Server Actions that write name what they
invalidate with `revalidateTag` or `revalidatePath`; nothing here invalidates
implicitly.
