import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PORTFOLIO_ITEM_COUNT } from '@/features/portfolio/constants';
import { PortfolioDetailView } from '@/features/portfolio/portfolio-detail-view';
import { routing } from '@/lib/i18n/routing';

type PortfolioDetailPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    Array.from({ length: PORTFOLIO_ITEM_COUNT }, (_, i) => ({
      slug: `${i}`,
      locale,
    })),
  );
}

export async function generateMetadata(props: PortfolioDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const t = await getTranslations({ locale, namespace: 'PortfolioSlug' });

  return {
    title: t('meta_title', { slug }),
    description: t('meta_description', { slug }),
  };
}

export default async function PortfolioDetailPage(props: PortfolioDetailPageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);

  return <PortfolioDetailView slug={slug} />;
}

export const dynamicParams = false;
