import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CounterView } from '@/features/counter/counter-view';

type CounterPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: CounterPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Counter' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function CounterPage(props: CounterPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <CounterView />;
}
