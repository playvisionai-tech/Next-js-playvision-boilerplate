import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/lib/i18n/navigation';
import sentryLogo from '@/public/assets/images/sentry-dark.png';
import { PORTFOLIO_ITEM_COUNT } from './constants';

export const PortfolioView = () => {
  const t = useTranslations('Portfolio');

  return (
    <>
      <p>{t('presentation')}</p>

      <div className="grid grid-cols-1 justify-items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: PORTFOLIO_ITEM_COUNT }, (_, i) => (
          <Link className="hover:text-blue-700" key={i} href={`/portfolio/${i}`}>
            {t('portfolio_name', { name: i })}
          </Link>
        ))}
      </div>

      <div className="mt-5 text-center text-sm">
        {`${t('error_reporting_powered_by')} `}
        <a
          className="text-blue-700 hover:border-b-2 hover:border-blue-700"
          href="https://sentry.io/for/nextjs/"
        >
          Sentry
        </a>
      </div>

      <a href="https://sentry.io/for/nextjs/">
        <Image className="mx-auto mt-2" src={sentryLogo} alt="Sentry" width={130} />
      </a>
    </>
  );
};
