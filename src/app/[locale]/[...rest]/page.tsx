import { notFound } from 'next/navigation';

/**
 * Catch-all so an unmatched path inside a locale renders the localized
 * not-found boundary rather than the root one.
 *
 * Without it Next 404s above the [locale] segment, and a French URL gets an
 * English 404. More specific routes always win over a catch-all, so this only
 * receives paths nothing else matched.
 *
 * @returns Never — it always throws to the not-found boundary.
 */
export default function LocaleCatchAll(): never {
  notFound();
}
