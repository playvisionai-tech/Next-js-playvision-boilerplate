'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { FORECAST_LOCATION, forecastQuery } from '@/lib/api/forecast';
import { useApiQuery } from '@/lib/api/query';

/**
 * The other half of this slice's data story.
 *
 * The notes above it are ours: a Server Component reads them and a Server
 * Action writes them. This card is someone else's data, on the far side of
 * CORS, and it changes while the page is open — the one row of
 * `agents/rules/data-fetching-decision.md` that calls for fetching in the
 * browser. Nothing here touches `src/lib/db`, and nothing there comes through
 * `lib/api`.
 *
 * @returns The rendered forecast card.
 */
export const ForecastCard = () => {
  const t = useTranslations('ExampleForecast');
  const format = useFormatter();
  const { data, error, isPending, isFetching, refetch } = useApiQuery(
    forecastQuery(FORECAST_LOCATION),
  );

  return (
    <section className="mt-6" data-testid="forecast">
      <h2 className="text-lg font-bold">{t('title')}</h2>
      <p className="text-sm text-gray-500">{t('explanation')}</p>

      <div className="mt-2">
        {isPending && <Skeleton className="h-16 w-72" />}

        {error && (
          <ErrorState
            description={t('error_description')}
            onRetry={refetch}
            retryLabel={t('retry')}
            title={t('error_title')}
          />
        )}

        {data && (
          <div aria-live="polite" data-testid="forecast-reading">
            <p className="text-base">
              {t('reading', {
                location: t('location'),
                temperature: format.number(data.celsius, {
                  style: 'unit',
                  unit: 'celsius',
                  maximumFractionDigits: 1,
                }),
                condition: data.condition,
              })}
            </p>
            <p className="text-xs text-gray-500">
              {t('observed_at', {
                time: format.dateTime(data.observedAt, { hour: 'numeric', minute: 'numeric' }),
              })}
            </p>
            <div className="mt-2">
              <Button disabled={isFetching} onClick={refetch} size="sm" variant="outline">
                {isFetching ? t('refreshing') : t('refresh')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
