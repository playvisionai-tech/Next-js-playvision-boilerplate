'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

      <div className="mt-2">
        <Button disabled={form.formState.isSubmitting} type="submit">
          {t('button_increment')}
        </Button>
      </div>
    </form>
  );
};
