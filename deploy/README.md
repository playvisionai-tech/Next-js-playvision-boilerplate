# Deploying the container image

The app builds to a self-contained Node server (`output: 'standalone'` in
`next.config.ts`). The `Dockerfile` at the repo root turns that into an image.

```bash
# The serving image (default target)
docker build -t nextjs-boilerplate:local .

# The migration job image
docker build --target migrator -t nextjs-boilerplate:migrator .
```

## Running it

```bash
docker network create app
docker run -d --name pg --network app \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=postgres \
  postgres:17-alpine

# Migrations first — see "How migrations run" below.
docker run --rm --network app \
  -e DATABASE_URL=postgresql://postgres:postgres@pg:5432/postgres \
  nextjs-boilerplate:migrator

docker run -d --name app --network app -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:postgres@pg:5432/postgres \
  -e CLERK_SECRET_KEY=sk_test_... \
  nextjs-boilerplate:local
```

## How migrations run

**Decision: a separate one-off job, not the app's entrypoint.**

The `migrator` stage is the same build as the app plus the devDependencies that
`drizzle-kit` needs. It runs `drizzle-kit migrate` against `DATABASE_URL` and
exits. Run it as a CI release step, a Kubernetes `Job`, a Fly `release_command`,
or an init container — anything that completes before the new app version starts
taking traffic.

The trade-off, stated plainly:

- **Entrypoint before boot** is one fewer moving part and cannot drift out of
  step with the code it ships alongside. But every replica runs it on every
  start: with N replicas they race for the same lock, and a migration that fails
  turns into a crashloop that never serves a request — including on replicas
  that were healthy a moment ago. Rollback then means rolling back a database,
  not a deployment.
- **A separate job** costs an orchestration step and a second image, and leaves
  a window where new schema and old code (or the reverse) are both live — so
  migrations must stay backward-compatible with the currently deployed release.
  In exchange, a failed migration fails the deploy instead of the service, it
  runs exactly once, and the serving image stays small and free of `drizzle-kit`.

The second is the better default for anything that scales past one replica, so
that is what this Dockerfile ships. If you run a single replica and want the
first option, add an entrypoint that runs `drizzle-kit migrate` before
`node server.js` — but build the app image from the `migrator` stage, because
the runtime stage deliberately has no `drizzle-kit` in it.

Note the size difference: the serving image is ~420 MB, the migrator ~2.3 GB
(it carries the full `node_modules`). The migrator is never a long-lived
container, so this costs pull time on deploy and nothing else. If that matters,
run `pnpm db:migrate` from CI against the target database instead and drop the
migrator image entirely.

## Traps this Dockerfile exists to avoid

Each of these produced a build that looked fine and served broken pages.

### `output: 'standalone'` copies neither `public/` nor `.next/static/`

The trace only follows the server's `import` graph. Static assets are not
imported, so they are not traced, so they are not in `.next/standalone`. Copy
both explicitly into the runtime stage:

```dockerfile
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
```

Without them the server boots and `/` renders, which is what makes this
convincing — but every `/_next/static/...` chunk 404s, so nothing hydrates, and
`/favicon.ico` and `/sw.js` 404 too.

### `public/sw.js` does not exist when Next traces files

`pnpm build:next` is `next build && serwist build`. The service worker is
written by the **second** command (see `serwist.config.js` and
`src/lib/pwa/spec.md`). Anything that copies `public/` from the build context,
or from a stage that only ran `next build`, ships a `public/` with no `sw.js` —
and `/sw.js` 404s while service worker registration fails silently in the
browser. The runtime stage copies `public/` from the builder **after**
`pnpm build:next` has finished, which is the only ordering that works.

### `HOSTNAME` must be `0.0.0.0`, never `127.0.0.1`

The standalone server reads `HOSTNAME` to decide what to bind. Setting it to
`127.0.0.1` also changes what next-intl's proxy considers same-origin: it reads
its own internal rewrite as an external URL and every default-locale route
(`/`, `/about`, `/counter`) redirects to itself forever, until the browser gives
up with `ERR_TOO_MANY_REDIRECTS`. Locale-prefixed routes (`/fr`) keep working,
which makes the failure look like an i18n bug rather than a bind-address one.
`0.0.0.0` is also required for the port to be reachable from outside the
container at all.

### Environment validation has no escape hatch

`src/lib/env.ts` calls `createEnv` from `@t3-oss/env-nextjs` without
`skipValidation`, and nothing in the repo wires up `SKIP_ENV_VALIDATION`. The
build therefore **cannot** skip validation: `CLERK_SECRET_KEY`, `DATABASE_URL`
and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` must all be non-empty strings at
`next build` time or the build fails. Locally that works only because the
committed `.env` supplies placeholders.

`.dockerignore` keeps `.env*` out of the build context so no placeholder secret
is baked into a layer, and the Dockerfile supplies build-time values instead:

- `NEXT_PUBLIC_*` is **inlined into the bundles at build time**. To change one,
  pass `--build-arg` and rebuild; setting it on `docker run` does nothing.
- `CLERK_SECRET_KEY` and `DATABASE_URL` are read from `process.env` at runtime.
  The builder's values are placeholders that never reach the runtime stage. Pass
  the real ones to `docker run`.

`next build` never opens a database connection — every page that reads the
counter is rendered on demand — so no database is needed to build the image.
(The comment in `.env.production` warning that a wrong `DATABASE_URL` makes the
build time out is stale.)
