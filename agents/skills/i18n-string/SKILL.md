---
name: i18n-string
description: Add or change user-facing copy in the message catalogs. Use whenever text a user will read is added, renamed, or removed, or when next-intl keys need checking across locales.
---

# Adding a string

No user-facing text is written inline. Every string is a key.

## 1. Pick the namespace

Namespaces are named for the component that renders them — `CounterForm`,
`ErrorState`, `Portfolio`. Page namespaces end in nothing special; the metadata
keys inside them are `meta_title` and `meta_description` by convention.

Key names are context-specific, not value-specific: `card_title`, not
`the_quick_brown_fox`. A key that describes its value has to change when the
copy changes, which defeats the point.

## 2. Add it to every locale

`src/messages/en.json` is the source. **Every other locale file must have the
same key**, or `pnpm check:i18n` fails. Adding to `en.json` alone is the usual
mistake.

Use sentence case. Error messages are short and do not include "please try
again" — the UI decides whether retrying is possible.

## 3. Read it correctly for the layer

```tsx
// Server component
const t = await getTranslations('Namespace');

// Client component
const t = useTranslations('Namespace');
```

For copy containing markup, use `t.rich(...)` rather than concatenating strings
around a component.

## 4. Check both directions

```bash
pnpm check:i18n
```

It fails on **missing** keys (a locale lacking one `en.json` has) and reports
**unused** keys (in a catalog but referenced nowhere). Both matter: the first
breaks a locale, the second is dead weight nobody dares delete later.

## 5. If the page is new

Every page under `src/app/[locale]/` must call `setRequestLocale(locale)`.
Omitting it silently drops the route out of static rendering. See
`agents/rules/quality-i18n-strings.md`.
