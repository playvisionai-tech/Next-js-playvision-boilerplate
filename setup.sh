#!/usr/bin/env bash
#
# One-shot setup for a fresh clone.
#
# Everything here is a step that a cold checkout genuinely needs and that
# `pnpm install` alone does not do — plus one assertion about a thing it does
# do, because that one fails open. Each one exists because it was hit for real,
# not because it seemed prudent.
#
# Usage:
#   ./setup.sh            install, prepare and verify
#   ./setup.sh --quick    skip the verification run at the end
#
set -euo pipefail

cd "$(dirname "$0")"

QUICK=false
[[ "${1:-}" == "--quick" ]] && QUICK=true

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
step "Checking Node"

command -v node >/dev/null 2>&1 || die "Node is not installed. This project needs Node 24 or newer."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 24 )); then
  die "Node $(node -v) found, but package.json requires >=24. Install Node 24 (nvm install 24) and re-run."
fi
ok "Node $(node -v)"

# ---------------------------------------------------------------------------
step "Enabling pnpm"

# The exact version is pinned by the packageManager field in package.json.
# Corepack reads it, so nobody has to remember which version this repo wants —
# and CI resolves it the same way, including inside container jobs.
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || die "Could not enable corepack. Install pnpm manually: npm i -g pnpm"
fi
corepack prepare --activate >/dev/null 2>&1 || true
ok "pnpm $(pnpm --version)"

# ---------------------------------------------------------------------------
step "Installing dependencies"

# pnpm refuses to run dependency install scripts unless they are allow-listed
# in pnpm-workspace.yaml. That is deliberate — it means a new transitive
# dependency cannot execute code on your machine without someone deciding it
# should. If install stops and asks about a package, that is the mechanism
# working; add it to allowBuilds after checking what its script does.
pnpm install
ok "dependencies installed"

# ---------------------------------------------------------------------------
step "Checking git hooks"

# Hooks install themselves during the `pnpm install` above: lefthook's own
# postinstall runs `lefthook install -f`, and the `lefthook: true` entry in
# pnpm-workspace.yaml is what permits it to run at all. That is the automatic
# path, and it rests on one line of a file about dependency scripts.
#
# What follows is the repair path, not a second install mechanism. The automatic
# path has two ordinary ways of not having happened: the postinstall skips
# itself whenever CI is set, and pnpm does not re-run a build script it has
# already run for the current node_modules, so a hooks directory cleared after
# the fact stays cleared through any number of installs.
#
# A missing hook fails open: commits succeed and the checks are simply absent,
# which is the same signal as passing. So assert the outcome, and run the
# install only when the assertion fails.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  warn "not a git checkout — commit hooks skipped"
elif hooks_dir="$(git config --get core.hooksPath 2>/dev/null || git rev-parse --git-path hooks)" \
  && [[ -x "$hooks_dir/pre-commit" && -x "$hooks_dir/commit-msg" ]]; then
  ok "commit hooks installed"
elif hook_output="$(pnpm exec lefthook install 2>&1)"; then
  ok "commit hooks installed"
else
  # lefthook refuses to install over a core.hooksPath someone set deliberately,
  # and its refusal names the three ways out. Swallowing that and printing a
  # generic "run lefthook install" would send the reader back to the command
  # that just declined.
  warn "commit hooks are NOT installed — ultracite, boundaries, knip and"
  warn "commitlint will not run on commit. lefthook said:"
  printf '%s\n' "$hook_output" | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
step "Generating Next.js types"

# Without this a cold checkout fails `check:types` with a dozen "cannot find
# module" errors for image imports, because next-env.d.ts does not exist yet.
# The errors are spurious and the cause is not obvious, which is exactly why
# this runs here rather than being left for someone to discover.
pnpm exec next typegen >/dev/null
ok "next-env.d.ts and route types generated"

# ---------------------------------------------------------------------------
step "Installing Playwright browsers"

# Both `pnpm test` and `pnpm test:e2e` need a real browser: Vitest runs its
# component tests in one, not in jsdom. Skipping this leaves the unit suite
# failing with an error that reads like a code problem rather than a missing
# binary.
if pnpm exec playwright install chromium >/dev/null 2>&1; then
  ok "chromium installed"
else
  warn "chromium install failed — run 'pnpm exec playwright install chromium' by hand"
fi

# ---------------------------------------------------------------------------
step "Checking environment"

# .env is committed with working local defaults, so there is nothing to copy
# and no credentials to obtain. The database is PGlite, started by the dev
# script itself and migrated on boot, so there is no Postgres to install.
[[ -f .env ]] || die ".env is missing. It is committed to this repo — restore it with 'git checkout .env'."
ok ".env present"

if grep -q '^CLERK_SECRET_KEY=your_clerk_secret_key' .env 2>/dev/null; then
  warn "CLERK_SECRET_KEY is still the placeholder."
  warn "Everything runs, but /sign-in, /sign-up and /dashboard will return a blank 500."
  warn "Put a real key in .env.local when you need auth - .env is tracked by git."
  warn "Get one at: https://dashboard.clerk.com"
fi

# ---------------------------------------------------------------------------
if [[ "$QUICK" == false ]]; then
  step "Verifying the setup"
  # The full chain, in the order the rules define: a type error makes every
  # later failure noise, and a boundary violation is structural rather than
  # behavioural. This is the same command CI runs.
  if pnpm verify; then
    ok "types, lint, boundaries, dependencies, i18n, tests and build all pass"
  else
    die "Verification failed. The output above shows which step; fix that before starting work."
  fi
else
  step "Skipping verification (--quick)"
  warn "Run 'pnpm verify' before committing."
fi

# ---------------------------------------------------------------------------
cat <<'EOF'

Setup complete.

  pnpm dev          start the app on :3000, with a local database
  pnpm verify       the full check chain — run this before committing
  pnpm test:e2e     Playwright, against its own server on :3008
  pnpm storybook    component workshop on :6006

Read AGENTS.md first if you are new here, or pointing an AI agent at this repo.
It routes to the rules, the skills and the per-feature docs.

EOF
