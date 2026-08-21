import { defineRouting } from 'next-intl/routing';
import { AppConfig } from '@/lib/config';

export const routing = defineRouting({
  locales: AppConfig.i18n.locales,
  localePrefix: AppConfig.i18n.localePrefix,
  defaultLocale: AppConfig.i18n.defaultLocale,
});
