import { currentUser } from '@clerk/nextjs/server';
import { getTranslations } from 'next-intl/server';

export const DashboardView = async () => {
  const t = await getTranslations('Dashboard');
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {email !== undefined && <p data-testid="signed-in-as">{t('signed_in_as', { email })}</p>}
      <p>{t('protected_note')}</p>
    </>
  );
};
