import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiProvider } from '@/lib/api/provider';
import { ForecastCard } from './components/forecast-card';
import { NoteForm } from './components/note-form';
import { NoteList } from './components/note-list';

export const ExampleView = () => {
  const t = useTranslations('Example');

  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p>{t('presentation')}</p>

      <NoteForm />

      {/* The list awaits the database, so it streams and the form is
          interactive before the query answers. */}
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <NoteList />
        </Suspense>
      </div>

      {/* The query cache is mounted here, not in the root layout: react-query
          would otherwise ship in every production page's shared chunk for a
          slice that has no route in production. See src/lib/api/spec.md. */}
      <ApiProvider>
        <ForecastCard />
      </ApiProvider>
    </>
  );
};
