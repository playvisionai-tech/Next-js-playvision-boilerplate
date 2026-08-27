# lib/store — decisions

## 2026-08-27 — `zustand` in `dependencies`, though nothing ships an import today

`selectors.ts` imports zustand with `import type` only, so the package is erased
from a production build. Everything else that imports it at runtime is a test.
On the face of it that is a `devDependencies` package.

**What the tooling actually said, in full.** Before the tests existed:

```
Unused files (1)
src/lib/store/selectors.ts
Unused dependencies (1)
zustand  package.json:65:6
```

Once the tests import the helper, `pnpm check:deps` is **silent** — with the
package in `dependencies` and, checked separately, with it in
`devDependencies`. knip never suggested a section. It was asked directly and it
does not distinguish the two, because its default mode does not split
production sources from dev ones.

Three things this rules out as arguments, each checked rather than assumed:

- The Docker build runs `pnpm install --frozen-lockfile` with no `--prod`, so
  it installs the package either way.
- `output: 'standalone'` traces actual imports, not `package.json` sections, so
  the runner image is identical either way.
- `knip --production` does flag `zustand` in `dependencies` — but that mode is
  not part of `pnpm verify` or of CI, and it already reports four unused files
  and six unused exports that predate this change. It is not a gate this repo
  holds itself to.

So no check decides it, and it comes down to what the section means.
`dependencies`, on two grounds. `src/lib/store/selectors.ts` is application
source rather than tooling, and its only purpose is to be called from shipped
client code; the type-only footprint is a property of there being no store yet,
not of the package's role. And the two mistakes are not symmetrical. Declared
here too early, it is one unused entry in a production install, visible and
self-correcting the moment a store lands. Declared in `devDependencies`, the
first store makes it a genuine runtime import and **nothing in this repo would
say so** — verify stays green, the image still builds — leaving the manifest
quietly lying to anyone who reads `dependencies` as "what ships", including
`pnpm deploy --prod` and any scanner that filters that way.

**Rejected: `ignoreDependencies` in `knip.config.ts`.** Never needed. Worth
recording that it was not, because it would have been the wrong fix twice over:
the entry would have been false the moment a test imported the helper, and
`treatConfigHintsAsErrors: true` makes a stale ignore entry a build failure
rather than dead configuration.

## 2026-08-27 — a module directory, not a line in `src/lib/utils.ts`

`utils.ts` was the other candidate, and it is where the codebase this was ported
from keeps the same helper.

Against it: `utils.ts` holds `cn`, `getBaseUrl` and `getI18nPath` — helpers with
no vendor behind them, imported by nearly every UI primitive. Putting a
zustand-shaped helper there makes the repo's most-imported module the one place
a third party is named, which is the opposite of the one-import-site rule in
`agents/skills/add-dependency/SKILL.md`. `src/lib/api` and `src/lib/firebase`
already establish the alternative: a vendor gets a directory.

The deciding reason is enforcement. `scripts/spec-modules.js` returns no module
for a loose file directly inside `src/lib/`, so `utils.ts` owes no `spec.md` and
can never be made to owe one. This helper's most important fact — that nothing
calls it — has to be written down somewhere a reader will find it and a check
will keep current. A module directory owes a `spec.md`; `check:specs` enforces
it. That the honest sentence gets an enforced home is the whole argument.

The cost is a directory named `store` that contains no store. `spec.md` opens by
saying so.

## 2026-08-27 — one suppressed type assertion, rather than a looser type

`typescript/no-unsafe-type-assertion` rejects the last line of `selectors.ts`,
and it is right to: an object keyed from `Object.keys(getState())` cannot be
checked against a type mapped over that same state. TypeScript has no way to
know the two key sets are the same set.

The first draft had three such assertions — one to read a field off the state,
one to build the namespace, one to return it. Two were avoidable and are gone:
the field read goes through `Reflect.get` into an `unknown` local, and building
and attaching are one `Object.assign`. The remaining one is the claim itself,
on one line, with the reason above it.

Confirmed necessary rather than assumed: removing the directive reproduces the
error. `reportUnusedDisableDirectives: 'error'` is on, so if a future
TypeScript makes the assertion checkable, the directive fails the build instead
of quietly outliving its reason.

**Rejected: turning the rule off in `oxlint.config.ts`.** It is a global switch
for a local problem, and this repo already answers this exact rule the local
way in `src/lib/offline-queue/store.ts`.

**Rejected: an overload whose implementation signature is loose enough to hide
the conversion.** It removes the assertion without removing the unsafety, and
costs a reader more than the one line it deletes.

One wrinkle worth knowing, since it is not this change's doing: run
`ultracite check` *without* `--type-aware` and the directive is reported as
unused, because the rule it suppresses does not run in that mode. The
offline-queue directive behaves identically. Every enforced path — `pnpm lint`
and the lefthook pre-commit job — passes both flags, so this is only a trap
when invoking ultracite by hand on a subdirectory.

## 2026-08-27 — tested against a real store, in both a node and a browser test

The port's original test builds a fake store out of `jest.fn()` and asserts
against it, which mostly proves the fake behaves like the fake.

Here both test files call zustand's own `create`. The split is not duplication:
`selectors.test.ts` runs in the node project and covers what needs no React —
identity, which keys get a hook, and that wrapping does not disturb the store's
own API. Everything the helper actually produces is a React hook, and a hook
cannot be invoked outside a renderer, so `selectors.test.tsx` runs in the
browser project and renders real components. That is the only place the claim
this helper exists for can be tested at all: a component reading `use.label`
does not re-render when `count` changes.

**Rejected: node-only, with a stub for the hooks.** It would have left the
selective-subscription claim — the reason to prefer this over subscribing to the
whole store — asserted in prose and checked nowhere.

Both tests import `create` from zustand directly, so the package has three
import sites in `src/` rather than the one the add-dependency skill asks for.
All three are inside this directory, which is what that rule is protecting —
the grep it prescribes returns nothing outside `src/lib/store/`. A test that
built the store from anything but the real `create` would be testing the
substitute, which is the failure being corrected here.

## 2026-08-27 — a helper with no store, rather than a reference store

Recorded because the next reader will ask. The reference codebase has no store
either, so there was no implementation to port; the choice between shipping a
worked reference store and shipping the convention alone was put to the user,
and they chose the convention alone. Session-only, no persistence, no UI.

The consequence is stated in `spec.md` rather than argued here: the helper has
no production evidence behind it, and knip's silence rests on its tests.
