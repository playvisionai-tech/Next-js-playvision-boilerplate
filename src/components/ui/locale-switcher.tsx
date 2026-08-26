'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ChangeEventHandler } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { routing } from '@/lib/i18n/routing';

export const LocaleSwitcher = () => {
  const t = useTranslations('LocaleSwitcher');
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const selectRef = useRef<HTMLSelectElement>(null);

  const switchTo = useCallback(
    (newLocale: string) => {
      const { search } = window.location;
      router.push(`${pathname}${search}`, { locale: newLocale, scroll: false });
    },
    [pathname, router],
  );

  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const newLocale = event.target.value;

    if (newLocale === locale) {
      return;
    }

    switchTo(newLocale);
  };

  /*
   * The server sends this select fully interactive, before any of React has
   * arrived. A choice made in that window fires a `change` event that nothing
   * is listening for, and the browser does not replay it once React attaches
   * its listener — so the switch was silently dropped and the control sat
   * showing a language the page was not in. Worse, it stayed that way:
   * re-picking the same option fires no further event, so the only way out was
   * to select a third value.
   *
   * The select is uncontrolled, so that choice is still sitting in the DOM.
   * Read it once on mount and act on it. When nothing was touched the value
   * equals the active locale and this does nothing.
   */
  useEffect(() => {
    const selected = selectRef.current?.value;

    if (selected && selected !== locale) {
      switchTo(selected);
    }
  }, [locale, switchTo]);

  return (
    <select
      ref={selectRef}
      defaultValue={locale}
      onChange={handleChange}
      className="border border-gray-300 font-medium focus:outline-hidden focus-visible:ring-3"
      aria-label={t('change_language')}
    >
      {routing.locales.map((elt) => (
        <option key={elt} value={elt}>
          {elt.toUpperCase()}
        </option>
      ))}
    </select>
  );
};
