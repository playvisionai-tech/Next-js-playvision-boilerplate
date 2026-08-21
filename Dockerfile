# syntax=docker/dockerfile:1

# Container image for the Next.js standalone server.
#
# Stages:
#   deps     - dependency install, cached on the lockfile alone
#   builder  - `next build` + `serwist build`
#   migrator - one-off job image that applies drizzle migrations (see deploy/README.md)
#   runner   - the image that serves traffic (default target)

ARG NODE_VERSION=24-slim
ARG PNPM_VERSION=11.22.0

# ---------------------------------------------------------------------------
# base
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base

ARG PNPM_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------------------------------------------------------------------------
# deps - only the manifests are copied, so this layer is reused for every
# source-only change. NODE_ENV is deliberately unset: the build needs
# devDependencies (typescript, tailwindcss, @serwist/cli, react compiler).
# ---------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir=/pnpm/store

# ---------------------------------------------------------------------------
# builder
#
# `src/lib/env.ts` validates with T3 Env and does NOT set `skipValidation`,
# so there is no SKIP_ENV_VALIDATION escape hatch: every required variable
# must have a value at build time. `.env` is kept out of the build context
# (see .dockerignore), so the values come from these build args instead.
#
# NEXT_PUBLIC_* is inlined into the bundles at build time. Changing one after
# the fact needs a rebuild, not a restart. Server-only secrets
# (CLERK_SECRET_KEY, DATABASE_URL, ARCJET_KEY) are read from the process
# environment at runtime, so the placeholders below never leave this stage.
# ---------------------------------------------------------------------------
FROM base AS builder

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cmVsYXhlZC10dXJrZXktNjcuY2xlcmsuYWNjb3VudHMuZGV2JA
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_LOGGING_LEVEL=info
ARG NEXT_PUBLIC_SENTRY_DISABLED=true

ENV NODE_ENV=production
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_LOGGING_LEVEL=${NEXT_PUBLIC_LOGGING_LEVEL}
ENV NEXT_PUBLIC_SENTRY_DISABLED=${NEXT_PUBLIC_SENTRY_DISABLED}
# Placeholders only. Every page that touches the database is rendered on
# demand, so `next build` never opens a connection.
ENV CLERK_SECRET_KEY=sk_build_placeholder
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `next build` writes .next/standalone; `serwist build` writes public/sw.js.
# The service worker exists only after the second command, which is why
# public/ is copied into the runner from this stage and not from the context.
RUN pnpm build:next

# ---------------------------------------------------------------------------
# migrator - a one-off job image, not a server. See deploy/README.md.
# ---------------------------------------------------------------------------
FROM builder AS migrator

USER node
CMD ["pnpm", "exec", "drizzle-kit", "migrate"]

# ---------------------------------------------------------------------------
# runner
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 0.0.0.0, never 127.0.0.1. On loopback, next-intl reads its own rewrite as an
# external URL and every default-locale route redirects forever.
ENV HOSTNAME=0.0.0.0
# Re-declared so a server-side read agrees with the value inlined at build time.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cmVsYXhlZC10dXJrZXktNjcuY2xlcmsuYWNjb3VudHMuZGV2JA
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# `output: 'standalone'` traces the server and its dependencies. It copies
# NEITHER public/ NOR .next/static/ — both are copied explicitly below.
# Without them /sw.js, /favicon.ico and every static chunk 404.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
