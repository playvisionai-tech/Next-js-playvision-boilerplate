import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/ui/empty-state';
import { Link } from '@/lib/i18n/navigation';

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
