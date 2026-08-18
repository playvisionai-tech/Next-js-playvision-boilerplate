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

**Enforced by:** CI — warns (does not block) when a feature changes without its
spec. Some changes really are internal.
