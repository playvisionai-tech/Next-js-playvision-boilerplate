# Commands

All commands are `pnpm`. There is no npm lockfile and bun is not used.

## First run

| Command | What it does |
|---|---|
| `./setup.sh` | Node check, corepack, install, `next typegen`, Playwright browser, then `pnpm verify`. |
| `./setup.sh --quick` | The same without the verification run. |

`next typegen` matters: without it a cold checkout fails `check:types` with
spurious "cannot find module" errors for image imports.

## Verification

| Command | What it checks |
|---|---|
| `pnpm verify` | The whole chain, in order. Use this before committing. |
| `pnpm check:types` | `tsc --noEmit`. Run first — a type error makes later failures noise. |
| `pnpm lint` | Ultracite: Oxlint + Oxfmt, type-aware. |
| `pnpm check:boundaries` | ESLint, import zones only. Cross-feature and cross-layer imports. |
| `pnpm check:deps` | Knip: unused dependencies, exports, and files. |
| `pnpm check:i18n` | Missing and unused message keys across locales. |
| `pnpm test` | Vitest, both projects. Only runs files inside a `__tests__/` folder. |
| `pnpm test:e2e` | Playwright against a real build. Needs `pnpm exec playwright install`. |

## Development

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server plus a file-backed PGlite database. No credentials needed. |
| `pnpm build-local` | Production build against an in-memory PGlite. What CI runs. |
| `pnpm build` | Migrate, then build. For a real database. |
| `pnpm storybook` | Storybook on :6006. |

## Database

| Command | What it does |
|---|---|
| `pnpm db:generate` | Generate a migration after editing `src/lib/db/schema.ts`. |
| `pnpm db:migrate` | Apply migrations. |
| `pnpm db:studio` | Drizzle Studio. |

## Notes

- `pnpm test` runs two projects: `unit` in node and `ui` in a real browser.
  A test file outside a `__tests__/` folder does not run at all.
- `pnpm test:e2e` starts its own server on port 3008, so it does not collide
  with `pnpm dev`.
- Adding a dependency whose install script must run means adding it to
  `allowBuilds` in `pnpm-workspace.yaml` — pnpm blocks them by default. If an
  install stops to ask about a package, that is the mechanism working.
