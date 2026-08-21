import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Env } from '@/lib/env';
import { routing } from '@/lib/i18n/routing';

/**
 * Resolves the public base URL of the application.
 * @returns The configured public app URL or the local development URL.
 */
export const getBaseUrl = () => {
  if (Env.NEXT_PUBLIC_APP_URL) {
    return Env.NEXT_PUBLIC_APP_URL;
  }

  return 'http://localhost:3000';
};

/**
 * Builds a locale-aware path by prefixing non-default locales.
 * @param url The base application-relative path starting with a slash.
 * @param locale The active locale identifier.
 * @returns The localized path, prefixed when the locale is not the default locale.
 */
export const getI18nPath = (url: string, locale: string) => {
  if (locale === routing.defaultLocale) {
    return url;
  }

  return `/${locale}${url}`;
};

/**
 * Merges class names, letting later Tailwind utilities win over earlier ones.
 *
 * Used by the shadcn primitives in components/ui so a caller can override a
 * variant's classes without fighting specificity.
 *
 * @param inputs Class values, in the order they should be applied.
 * @returns The merged class string.
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
