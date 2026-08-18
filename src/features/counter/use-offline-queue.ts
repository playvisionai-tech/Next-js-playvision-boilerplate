'use client';

import { useCallback, useEffect, useState } from 'react';
import { LOCAL_DB_CHANNEL } from '@/lib/local-db/client';
import { countPending, drainPending, enqueueIncrement } from './local/queue';
import { incrementCounter } from './server/mutations';

/**
 * Keeps the offline write queue in sync with the server.
 *
 * Flushing runs on reconnect and on mount. It deliberately does not run on a
 * timer: every open tab would run its own, and the queue would be drained
 * several times over.
 *
 * @returns The pending count and a submit function that queues when offline.
 */
export function useOfflineQueue() {
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    setPending(await countPending());
  }, []);

  const flush = useCallback(async () => {
    const queued = await drainPending();

    for (const increment of queued) {
      const result = await incrementCounter({ increment });

      if (result.status !== 'ok') {
        // Re-queue rather than silently dropping the user's write.
        await enqueueIncrement(increment);
      }
    }

    await refresh();
  }, [refresh]);

  const submit = useCallback(
    async (increment: number) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueueIncrement(increment);
        await refresh();

        return;
      }

      const result = await incrementCounter({ increment });

      if (result.status !== 'ok') {
        await enqueueIncrement(increment);
        await refresh();
      }
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();

    const onOnline = () => {
      void flush();
    };

    const channel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(LOCAL_DB_CHANNEL);

    const onMessage = () => {
      void refresh();
    };

    channel?.addEventListener('message', onMessage);

    globalThis.addEventListener('online', onOnline);

    return () => {
      globalThis.removeEventListener('online', onOnline);
      channel?.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [flush, refresh]);

  return { pending, submit };
}
