---
name: new-ui-primitive
description: Add a component to the shared UI kit in src/components/ui, or decide whether it belongs there at all. Use before creating any new button, input, card, dialog, empty state, or other reusable piece of interface.
---

# New UI primitive

The most common mistake in this codebase is writing a component that already
exists. Start here, not with a new file.

## 1. Read the inventory first

`src/components/ui/spec.md` lists everything in the kit and what each is for.
If something there fits, use it. This step is not optional and it is not a
formality — the inventory exists because duplicate-component sprawl is the
failure mode of every React codebase.

## 2. Apply the promotion rule

A component belongs in `components/ui` only when **2+ features use it AND it has
no feature-specific logic**.

If only one feature uses it, it lives in `features/<f>/components/`, even if you
expect a second caller later. Two similar components are cheaper to unpick than
one wrong abstraction.

## 3. Decide server-safe or not

Add `'use client'` only for state, effects, event handlers, or browser APIs — and
prefer designing the component so it does not need them. A server-safe primitive
can be used anywhere; a client one turns its whole importing subtree into client
code.

If a component needs an interactive affordance only sometimes, take a callback
prop and let the caller decide, the way `EmptyState` takes `action`.

## 4. Write it, test it, register it

- The component in `src/components/ui/<name>.tsx`
- A test in `src/components/ui/__tests__/<name>.test.tsx` covering variants,
  disabled and loading states, and accessibility props — not styling output
- An export in `index.ts`, the one allowed barrel
- **A row in `spec.md`, including the server-safe column**

Step four is the one that gets skipped, and skipping it is what makes the next
person write your component again.

## 5. Accessibility lives here

Keyboard handling, focus management, and labelling belong in the primitive and
are tested once here. A screen-by-screen accessibility pass is a treadmill; a
correct primitive is a fix.
