import { useTranslations } from 'next-intl';
import Image from 'next/image';
import codeRabbitLogo from '@/public/assets/images/coderabbit-logo-light.svg';

export const PortfolioDetailView = (props: { slug: string }) => {
  const t = useTranslations('PortfolioSlug');

  return (
    <>
      <h1 className="capitalize">{t('header', { slug: props.slug })}</h1>
      <p>{t('content')}</p>

      <div className="mt-5 text-center text-sm">
        {`${t('code_review_powered_by')} `}
        <a
          className="text-blue-700 hover:border-b-2 hover:border-blue-700"
          href="https://www.coderabbit.ai"
        >
          CodeRabbit
        </a>
      </div>

      <a href="https://www.coderabbit.ai">
        <Image className="mx-auto mt-2" src={codeRabbitLogo} alt="CodeRabbit" width={130} />
      </a>
    </>
  );
};
