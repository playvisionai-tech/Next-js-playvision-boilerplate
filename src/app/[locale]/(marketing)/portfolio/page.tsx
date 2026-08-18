import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PortfolioView } from '@/features/portfolio/portfolio-view';

type PortfolioPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: PortfolioPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Portfolio' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function PortfolioPage(props: PortfolioPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <PortfolioView />;
}
