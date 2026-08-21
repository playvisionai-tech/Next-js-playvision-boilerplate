import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
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
    </>
  );
};
