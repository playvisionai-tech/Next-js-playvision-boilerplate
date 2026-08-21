import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type AboutPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: AboutPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'About' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

/**
 * Placeholder about page. It exists so a second route — and locale switching
 * between two routes — is verifiable from the first run.
 *
 * @param props Route props carrying the locale segment.
 * @returns The rendered about page.
 */
export default async function AboutPage(props: AboutPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'About' });

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p>{t('description')}</p>
    </>
  );
}
