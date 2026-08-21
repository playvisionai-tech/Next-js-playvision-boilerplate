---
title: Every locale page calls setRequestLocale
impact: MEDIUM
impactDescription: Prevents pages silently dropping out of static rendering
paths:
  - 'src/app/[locale]/**'
  - 'src/messages/**'
tags: i18n, rendering
---

## Every locale page calls setRequestLocale

Every page under `src/app/[locale]/` must call `setRequestLocale(locale)` after
awaiting params. Omitting it throws nothing and breaks nothing visible — the page
still renders. It just stops being statically rendered, and only the build output
says so.

**Incorrect (works, and is slower on every request forever):**

```tsx
export default async function Page(props: PageProps) {
  const { locale } = await props.params;

  return <ThingsView />;
}
```

**Correct:**

```tsx
export default async function Page(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <ThingsView />;
}
```

All user-facing text goes in `src/messages/en.json` under a namespace named for
the component. Server components read it with `getTranslations`; client
components with `useTranslations`. Never inline a user-facing string.

Use `Link` from `@/lib/i18n/navigation`, not `next/link` — the latter drops the
locale segment.

**Tripwire:** A `page.tsx` under `[locale]/` with no `setRequestLocale`. A
string literal in JSX that a user will read.

**Enforced by:** CI — a grep asserts every locale page contains the call, and
`pnpm check:i18n` asserts key parity across locales.
