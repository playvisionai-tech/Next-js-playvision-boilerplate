import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/ui/empty-state';
import { listNotes } from '../server/queries';

export const NoteList = async () => {
  const t = await getTranslations('ExampleList');
  const notes = await listNotes();

  if (notes.length === 0) {
    return <EmptyState description={t('empty_description')} title={t('empty_title')} />;
  }

  // The list changes in place after a submit, so a screen reader must be told
  // rather than left to discover it.
  return (
    <ul aria-live="polite" className="text-base" data-testid="note-list">
      {notes.map((note) => (
        <li key={note.id}>{note.body}</li>
      ))}
    </ul>
  );
};
