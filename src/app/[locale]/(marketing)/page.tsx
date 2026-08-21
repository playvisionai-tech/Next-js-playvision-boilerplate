import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: HomePageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Home' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

/**
 * Placeholder home page. It holds copy rather than a component from
 * `features/` because there is no capability behind it yet — replace the whole
 * body with your own feature's view.
 *
 * @param props Route props carrying the locale segment.
 * @returns The rendered home page.
 */
export default async function HomePage(props: HomePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Home' });

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p>{t('description')}</p>
    </>
  );
}
