'use client';
// `register` mutates react-hook-form's field map while rendering, which breaks
// the Rules of React. The React Compiler — enabled in production builds only —
// is free to skip that call on a re-render, and does: after the first submit the
// field stops reporting changes and every later submit re-sends the first value.
// This is react-hook-form's documented escape hatch; remove it when the form
// moves to a compiler-safe API.
'use no memo';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { noteInputSchema } from '../schema';
import { useExampleQueue } from '../use-example-queue';

const ERROR_ID = 'note-error';

export const NoteForm = () => {
  const t = useTranslations('ExampleForm');
  const { pending, rejected, submit, discard, retry } = useExampleQueue();
  const form = useForm({
    resolver: zodResolver(noteInputSchema),
    defaultValues: { body: '' },
  });

  const hasError = form.formState.errors.body !== undefined;

  const handleAdd = form.handleSubmit(async (formData) => {
    await submit({ body: formData.body });
    form.reset({ body: '' });
  });

  // noValidate: the browser's own constraint check runs before React Hook Form
  // and blocks submission with a bubble in the BROWSER's language, not the
  // app's. maxLength stays as an affordance.
  return (
    <form noValidate onSubmit={handleAdd}>
      <div className="flex items-center gap-2">
        <Label htmlFor="note-body">{t('label_body')}</Label>
        <Input
          aria-describedby={hasError ? ERROR_ID : undefined}
          aria-invalid={hasError}
          className="w-72"
          id="note-body"
          maxLength={80}
          type="text"
          {...form.register('body')}
        />
      </div>

      {hasError && (
        <div className="my-2 text-xs text-red-500 italic" id={ERROR_ID} role="alert">
          {t('error_body_length')}
        </div>
      )}

      {pending > 0 && (
        <div
          aria-live="polite"
          className="my-2 text-xs text-amber-700 italic"
          data-testid="pending-notes"
        >
          {t('pending_notes', { count: pending })}
        </div>
      )}

      {rejected > 0 && (
        <div className="my-2 text-xs text-red-600 italic" data-testid="rejected-notes">
          {t('rejected_notes', { count: rejected })}{' '}
          <button className="underline" data-testid="retry-rejected" onClick={retry} type="button">
            {t('retry_rejected')}
          </button>{' '}
          <button
            className="underline"
            data-testid="discard-rejected"
            onClick={discard}
            type="button"
          >
            {t('discard_rejected')}
          </button>
        </div>
      )}

      <div className="mt-2">
        <Button disabled={form.formState.isSubmitting} type="submit">
          {t('button_add')}
        </Button>
      </div>
    </form>
  );
};
