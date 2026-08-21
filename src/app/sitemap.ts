import type { MetadataRoute } from 'next';
import { routing } from '@/lib/i18n/routing';
import { getBaseUrl, getI18nPath } from '@/lib/utils';

/**
 * Every public route, listed by hand.
 *
 * There is no filesystem crawl here on purpose: not every route belongs in a
 * sitemap — authenticated areas and development-only routes do not — and a
 * crawl cannot tell which is which. Add a path when you add a public page.
 */
const routes = ['', '/about'];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    alternates: {
      languages: Object.fromEntries(
        routing.locales
          .filter((locale) => locale !== routing.defaultLocale)
          .map((locale) => [locale, `${baseUrl}${getI18nPath(route, locale)}`]),
      ),
    },
  }));
}
