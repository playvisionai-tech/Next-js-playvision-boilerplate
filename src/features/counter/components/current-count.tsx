import { getTranslations } from 'next-intl/server';
import { getCurrentCount } from '../server/queries';

export const CurrentCount = async () => {
  const t = await getTranslations('CurrentCount');
  const count = await getCurrentCount();

  // The count changes in place after a submit, so a screen reader must be told
  // rather than left to discover it.
  return (
    <div aria-live="polite" data-testid="current-count">
      {t('count', { count })}
    </div>
  );
};
