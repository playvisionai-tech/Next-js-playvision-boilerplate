import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExampleView } from '@/features/example/example-view';

/**
 * The reference slice's route.
 *
 * The `.dev.tsx` suffix is load-bearing: `next.config.ts` registers `dev.tsx`
 * in `pageExtensions` only when `NODE_ENV !== 'production'`, so outside
 * development this file is not a route at all — it is missing from the route
 * manifest and nothing it imports reaches the bundle.
 */
type ExamplePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: ExamplePageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Example' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function ExamplePage(props: ExamplePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <ExampleView />;
}
