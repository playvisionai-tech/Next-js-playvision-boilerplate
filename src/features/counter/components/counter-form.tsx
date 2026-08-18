'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { counterIncrementSchema } from '../schema';
import { useOfflineQueue } from '../use-offline-queue';

export const CounterForm = () => {
  const t = useTranslations('CounterForm');
  const { pending, submit } = useOfflineQueue();
  const form = useForm({
    resolver: zodResolver(counterIncrementSchema),
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
      <div>
        <label className="text-sm font-bold text-gray-700" htmlFor="increment">
          {t('label_increment')}
          <input
            id="increment"
            type="number"
            className="ml-2 w-32 appearance-none rounded-sm border border-gray-200 px-2 py-1 text-sm/tight text-gray-700 focus:ring-3 focus:ring-blue-300/50 focus:outline-hidden"
            {...form.register('increment', { valueAsNumber: true })}
          />
        </label>

        {form.formState.errors.increment && (
          <div className="my-2 text-xs text-red-500 italic">{t('error_increment_range')}</div>
        )}
      </div>

      {pending > 0 && (
        <div className="my-2 text-xs text-amber-700 italic" data-testid="pending-increments">
          {t('pending_increments', { count: pending })}
        </div>
      )}

      <div className="mt-2">
        <button
          className="rounded-sm bg-blue-500 px-5 py-1 font-bold text-white hover:bg-blue-600 focus:ring-3 focus:ring-blue-300/50 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {t('button_increment')}
        </button>
      </div>
    </form>
  );
};
