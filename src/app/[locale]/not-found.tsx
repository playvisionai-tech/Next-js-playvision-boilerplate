import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/ui/empty-state';
import { Link } from '@/lib/i18n/navigation';

/**
 * A not-found boundary can export metadata — Next resolves it from this file
 * when the error type is `not-found`. It receives no params, so the locale
 * comes from the request config rather than the route segment.
 *
 * @returns Title metadata for the not-found page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('NotFound');

  return {
    title: t('meta_title'),
  };
}

export default function LocaleNotFound() {
  const t = useTranslations('NotFound');

  return (
    <div className="px-1 py-10">
      <EmptyState
        action={
          <Link className="text-blue-700 hover:border-b-2 hover:border-blue-700" href="/">
            {t('back_home')}
          </Link>
        }
        description={t('description')}
        title={t('title')}
      />
    </div>
  );
}
