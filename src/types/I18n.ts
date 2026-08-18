import type { routing } from '@/lib/i18n/routing';
import type messages from '@/messages/en.json';

declare module 'next-intl' {
  // oxlint-disable-next-line typescript/consistent-type-definitions
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
