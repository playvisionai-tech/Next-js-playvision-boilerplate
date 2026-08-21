import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

/**
 * Catch-all so an unmatched path inside a locale renders the localized
 * not-found boundary rather than the root one.
 *
 * Without it Next 404s above the [locale] segment, and a French URL gets an
 * English 404. More specific routes always win over a catch-all, so this only
 * receives paths nothing else matched.
 *
 * `setRequestLocale` runs before `notFound` so the boundary resolves its
 * translations against the requested locale without opting into dynamic
 * rendering.
 *
 * @param props - Route props carrying the locale segment.
 * @returns Never — it always throws to the not-found boundary.
 */
export default async function LocaleCatchAll(props: {
  params: Promise<{ locale: string }>;
}): Promise<never> {
  const { locale } = await props.params;
  setRequestLocale(locale);

  notFound();
}
