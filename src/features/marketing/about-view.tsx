import { useTranslations } from 'next-intl';
import Image from 'next/image';
import crowdinLogo from '@/public/assets/images/crowdin-dark.png';

export const AboutView = () => {
  const t = useTranslations('About');

  return (
    <>
      <p>{t('about_paragraph')}</p>

      <div className="mt-2 text-center text-sm">
        {`${t('translation_powered_by')} `}
        <a
          className="text-blue-700 hover:border-b-2 hover:border-blue-700"
          href="https://l.crowdin.com/next-js"
        >
          Crowdin
        </a>
      </div>

      <a href="https://l.crowdin.com/next-js">
        <Image
          className="mx-auto mt-2"
          src={crowdinLogo}
          alt="Crowdin Translation Management System"
          width={130}
        />
      </a>
    </>
  );
};
