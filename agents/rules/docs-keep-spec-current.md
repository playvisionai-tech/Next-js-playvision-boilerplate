---
title: Behavior changes rewrite spec.md in the same change
impact: HIGH
impactDescription: Keeps docs describing the system rather than its history
paths:
  - 'src/features/**/spec.md'
  - 'src/lib/**/spec.md'
tags: docs, drift
---

## Behavior changes rewrite spec.md in the same change

`spec.md` describes what a module does **today**, in the present tense. When
behavior changes, rewrite it — never append. A spec that accumulates becomes a
changelog, and an agent reading a changelog cannot tell which parts are still
true.

`decisions.md` is the opposite: append-only, dated, and only for real forks in
the road — chose A over B for a reason someone could question later. Superseded
entries are marked superseded, never deleted.

**Incorrect (a spec turning into a history):**

```md
## Behavior
- Editing opens a dialog.
- As of August we also support bulk editing.
- Note: the old inline editor was removed.
```

**Correct (a spec describing now):**

```md
## Behavior
- Editing opens a dialog; bulk editing selects rows first, then applies once.
```

**If a spec contradicts the code, the code is right and the spec is a bug.**
Fix the spec in the same change rather than "fixing" working code to match it.

A decision lives where the code it constrains lives: an infrastructure choice
goes in `lib/<module>/decisions.md`, not in the feature that happened to
discover it.

**Tripwire:** A diff touching `features/<f>/**` with no change to that feature's
`spec.md`, where the behavior visibly changed. Also: the words "now", "no
longer", or a month name in a spec.

**Enforced by:** CI — `scripts/check-specs.js`, run as the "Spec drift" step on
pull requests targeting `main`, and by `pnpm check:specs` locally. It fails when
a changed module has no `spec.md`, when a module's code changed and its
`spec.md` did not, or when a live `spec.md` is deleted out from under a module
that still exists. Only changed modules are inspected, so it is a ratchet
rather than a repo-wide audit.

A test-only change does not trigger the **freshness** rule — a test changes
nothing a caller can observe, and demanding a spec edit for one produces
exactly the padding described above. It still counts the module as changed for
the **exists** rule, so a module with no `spec.md` is reported either way.

Some changes really are internal. Add a `Spec-Skip: <reason>` trailer to a
commit message to drop the freshness requirement for that range. It is parsed
as a git trailer, so mentioning it in prose does not arm it, and it is visible
in the pull request's commit list where a reviewer can question it. It applies
only when the check runs against a base ref: locally, where the changes are not
yet committed, no commit message authorizes anything and the trailer is
ignored. The trailer covers freshness only — a module with no `spec.md` at all
is still reported.

What the check cannot do is judge whether the rewrite was any good. It sees
that the file changed, not that it became true. That part is still review.
