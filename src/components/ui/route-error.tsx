'use client';

import { useTranslations } from 'next-intl';
import { startTransition, useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { useRouter } from '@/lib/i18n/navigation';

/**
 * The body every `error.tsx` boundary renders, including the retry that
 * actually recovers a failed server render.
 *
 * `reset()` on its own only re-renders the boundary's subtree from the RSC
 * payload the client already holds — the failed one — so a server error throws
 * again immediately. `router.refresh()` fetches a new payload, and the two must
 * run in one transition so React swaps the boundary out only once the refetched
 * tree is ready.
 *
 * @param props The thrown error and the reset callback Next.js provides.
 * @returns The rendered error state.
 */
export const RouteError = (props: { error: Error; reset: () => void }) => {
  const t = useTranslations('ErrorState');
  const router = useRouter();

  useEffect(() => {
    console.error(props.error);
  }, [props.error]);

  return (
    <div className="px-1 py-10">
      <ErrorState
        description={t('description')}
        onRetry={() => {
          startTransition(() => {
            router.refresh();
            props.reset();
          });
        }}
        retryLabel={t('retry')}
        title={t('title')}
      />
    </div>
  );
};
