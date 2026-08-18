'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

/**
 * Segment-level error boundary. Without this, any thrown error falls through
 * to global-error and the user loses the whole page chrome.
 *
 * @param props The thrown error and the reset callback Next.js provides.
 * @returns The rendered error state.
 */
export default function LocaleError(props: { error: Error; reset: () => void }) {
  const t = useTranslations('ErrorState');

  useEffect(() => {
    console.error(props.error);
  }, [props.error]);

  return (
    <div className="px-1 py-10">
      <ErrorState
        description={t('description')}
        onRetry={props.reset}
        retryLabel={t('retry')}
        title={t('title')}
      />
    </div>
  );
}
