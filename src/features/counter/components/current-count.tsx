import { getTranslations } from 'next-intl/server';
import { getCurrentCount } from '../server/queries';

export const CurrentCount = async () => {
  const t = await getTranslations('CurrentCount');
  const count = await getCurrentCount();

  return <div data-testid="current-count">{t('count', { count })}</div>;
};
