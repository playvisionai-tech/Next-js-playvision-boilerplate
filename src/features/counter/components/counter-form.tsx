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
import { counterIncrementInputSchema } from '../schema';
import { useOfflineQueue } from '../use-offline-queue';

export const CounterForm = () => {
  const t = useTranslations('CounterForm');
  const { pending, rejected, submit, discard } = useOfflineQueue();
  const form = useForm({
    resolver: zodResolver(counterIncrementInputSchema),
    defaultValues: {
      increment: 1,
    },
  });

  const handleIncrement = form.handleSubmit(async (formData) => {
    await submit(formData.increment);
    form.reset({ increment: formData.increment });
  });

  return (
    <form onSubmit={handleIncrement}>
      <p>{t('presentation')}</p>

      <div className="flex items-center gap-2">
        <Label htmlFor="increment">{t('label_increment')}</Label>
        <Input
          className="w-32"
          id="increment"
          type="number"
          {...form.register('increment', { valueAsNumber: true })}
        />
      </div>

      {form.formState.errors.increment && (
        <div className="my-2 text-xs text-red-500 italic">{t('error_increment_range')}</div>
      )}

      {pending > 0 && (
        <div className="my-2 text-xs text-amber-700 italic" data-testid="pending-increments">
          {t('pending_increments', { count: pending })}
        </div>
      )}

      {rejected > 0 && (
        <div className="my-2 text-xs text-red-600 italic" data-testid="rejected-increments">
          {t('rejected_increments', { count: rejected })}{' '}
          <button className="underline" onClick={discard} type="button">
            {t('discard_rejected')}
          </button>
        </div>
      )}

      <div className="mt-2">
        <Button disabled={form.formState.isSubmitting} type="submit">
          {t('button_increment')}
        </Button>
      </div>
    </form>
  );
};
