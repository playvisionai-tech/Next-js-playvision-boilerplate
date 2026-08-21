# Agent context index

- **[../AGENTS.md](../AGENTS.md)** — the always-on guide. Read on every session.
- **[commands.md](commands.md)** — full command reference.
- **[knowledge-base.md](knowledge-base.md)** — product domain and business
  rules. *Not created yet: there is no domain knowledge here that the code does
  not already state. Create it when there is, not before.*

## Rules

Loaded on every session. One file per topic, capped at ~40 lines, grouped by
filename prefix. Sections and impact levels are defined in
[rules/_sections.md](rules/_sections.md); the format is in
[rules/_template.md](rules/_template.md).

### Architecture — CRITICAL

- [architecture-server-client-boundary](rules/architecture-server-client-boundary.md) — `server/` and `local/` folders, and the imports that guard them
- [architecture-feature-slices](rules/architecture-feature-slices.md) — no cross-feature imports; sharing goes through `lib` or `components/ui`
- [architecture-thin-routes](rules/architecture-thin-routes.md) — what a route file may contain, as a closed list

### Data — CRITICAL

- [data-fetching-decision](rules/data-fetching-decision.md) — the Server Component calls the query directly; React Query is the exception

### Security — CRITICAL

- [security-headers-csp](rules/security-headers-csp.md) — headers set once, and never widened to make an error go away

### Quality — HIGH

- [quality-i18n-strings](rules/quality-i18n-strings.md) — `setRequestLocale` on every locale page; no inline user-facing text

### Testing — HIGH

- [testing-placement](rules/testing-placement.md) — flat `__tests__/` beside the subject, and the one root exception

### CI — HIGH

- [ci-verification-order](rules/ci-verification-order.md) — the fixed order, and the failures worth recognising rather than debugging

### Docs — HIGH

- [docs-keep-spec-current](rules/docs-keep-spec-current.md) — rewrite `spec.md`, append to `decisions.md`

## Skills

Loaded on demand when the task matches. Live in [skills/](skills), symlinked
into `.claude/skills` and `.cursor/skills` so every tool reads one source.

| Skill | Use when |
|---|---|
| [new-feature](skills/new-feature/SKILL.md) | Adding a capability that does not fit an existing slice |
| [new-ui-primitive](skills/new-ui-primitive/SKILL.md) | Before creating any reusable piece of interface |
| [i18n-string](skills/i18n-string/SKILL.md) | Adding or changing user-facing copy |
| [verify](skills/verify/SKILL.md) | Before committing, or when a check fails unclearly |

## Living docs, beside the code

These are not listed here because they live next to what they describe, and
that is the point — an agent editing a file sees them in the same directory.

- `src/features/<name>/spec.md` — what the feature does today
- `src/features/<name>/decisions.md` — why, and what was rejected
- `src/lib/<module>/spec.md` — for modules whose behavior is not obvious
- `src/components/ui/spec.md` — the UI inventory. Read it before building UI.
