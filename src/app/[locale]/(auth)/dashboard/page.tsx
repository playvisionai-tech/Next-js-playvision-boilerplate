import { setRequestLocale } from 'next-intl/server';
import { DashboardView } from '@/features/dashboard/dashboard-view';

export default async function DashboardPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className="py-5 [&_p]:my-6">
      <DashboardView />
    </div>
  );
}
