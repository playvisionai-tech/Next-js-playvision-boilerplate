# lib/i18n — current behavior

## What this module does

Locale routing and message loading for next-intl.

## Behavior

- `routing.ts` defines the locale list and prefix strategy from `lib/config.ts`.
- `index.ts` is the next-intl request config: it resolves the requested locale,
  falls back to the default when it is not recognised, and loads the matching
  catalog from `src/messages/`.
- `navigation.ts` exports locale-aware `Link`, `usePathname`, and `useRouter`.
  Use these rather than the ones from `next/link` and `next/navigation`, or
  links will drop the locale segment.

## The rule that is easy to miss

**Every page under `src/app/[locale]/` must call `setRequestLocale(locale)`.**
Omitting it does not throw — it silently opts the route out of static rendering,
so the page still works and only the build output tells you. CI greps for it.

Server components read translations with `getTranslations`; client components
use `useTranslations`.

## Where the data lives

`src/messages/<locale>.json`. `pnpm check:i18n` asserts every locale has the
keys `en.json` has, and flags keys nothing uses.

## Out of scope

Locale detection from headers, and RTL. Neither is implemented.
