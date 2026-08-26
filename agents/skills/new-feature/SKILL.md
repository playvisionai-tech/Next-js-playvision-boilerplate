---
name: new-feature
description: Scaffold a new vertical feature slice under src/features with its server tier, tests, docs, route wiring, and ESLint boundary zone. Use when adding a new capability to the app, when the user says "add a feature", or when a change does not fit any existing slice.
---

# New feature slice

Creating a slice by hand reliably forgets one of: the `server-only` import, the
boundary zone, the route's `loading.tsx`, or `setRequestLocale`. Each omission
fails quietly. This is the checklist.

## 1. Decide the storage tier first

Before writing anything, answer in order:

1. **Who has to see this data?** More than one browser → server database, so the
   slice needs `server/`.
2. **Must it survive a reload?** No → React state, or the URL via the route's
   `searchParams` and `useSearchParams`. No persistence folder at all.
3. Everything else → browser storage, so the slice needs `local/`.

Never keep the same fact in two tiers without naming which is authoritative.

## 2. Create the slice

```
src/features/<name>/
├── spec.md               # write it last, describing what you actually built
├── <name>-view.tsx       # the one component the route renders
├── schema.ts             # Zod, if anything crosses the boundary
├── components/
│   └── __tests__/
├── server/               # only if step 1 said server database
│   ├── queries.ts        # first line: import 'server-only';
│   └── mutations.ts      # 'use server'; then import 'server-only';
└── __tests__/
```

Do not create a `__tests__/` folder you are not putting a test in.

## 3. Register the boundary zone

**This is the step that fails open if skipped.** In
`eslint.boundaries.config.mjs`, add to `zones`:

```js
{
  target: './src/features/<name>',
  from: './src/features',
  except: ['./<name>'],
  message: 'No cross-feature imports. Share via components/ui or lib/.',
},
```

Without it the slice can import any other feature and nothing complains.

## 4. Wire the route

`src/app/[locale]/.../page.tsx` gets metadata, `await props.params`,
`setRequestLocale(locale)`, and one component from the slice. Nothing else.

Add `loading.tsx` beside it if the view awaits anything. Add `error.tsx` if the
segment can fail in a way the locale-level boundary should not swallow.

## 5. Strings and docs

Every user-facing string goes in `src/messages/en.json` under a namespace named
for the component, and in every other locale file. Then write `spec.md`
describing present-tense behavior, and `decisions.md` only if a real fork in the
road was taken.

## 6. Verify

```bash
pnpm verify
```

Confirm the new tests appear in the run output. A test file outside a
`__tests__/` folder does not run, and silence looks like success.
