'use client';

import { useCallback, useEffect, useState } from 'react';
import { LOCAL_DB_CHANNEL } from '@/lib/local-db/client';
import {
  ackIncrement,
  countPending,
  countRejected,
  discardRejected,
  enqueueIncrement,
  listSendable,
  recordAttempt,
  rejectIncrement,
} from './local/queue';
import { incrementCounter } from './server/mutations';

const FLUSH_LOCK = 'counter-flush';

/**
 * Runs a job under a browser-wide lock, or skips it if another tab holds one.
 *
 * `navigator.locks` is absent — not merely restricted — outside a secure
 * context, so plain-HTTP origins need the same feature detection the
 * BroadcastChannel helper uses. Without a lock the job still runs: React
 * StrictMode double-invokes effects in development, so this guards a single
 * tab as much as several.
 *
 * @param job Work that must happen at most once per browser at a time.
 * @returns Resolves once the job has run, or immediately if another holder has it.
 */
async function withFlushLock(job: () => Promise<void>) {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) {
    await job();

    return;
  }

  await navigator.locks.request(FLUSH_LOCK, { ifAvailable: true }, async (lock) => {
    if (lock) {
      await job();
    }
  });
}

/**
 * Keeps the offline write queue in sync with the server.
 *
 * @returns Pending and rejected counts, a submit function, and a discard action.
 */
export function useOfflineQueue() {
  const [pending, setPending] = useState(0);
  const [rejected, setRejected] = useState(0);

  const refresh = useCallback(async () => {
    setPending(await countPending());
    setRejected(await countRejected());
  }, []);

  const flush = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    await withFlushLock(async () => {
      for (const row of await listSendable()) {
        if (row.id === undefined) {
          continue;
        }

        let result: Awaited<ReturnType<typeof incrementCounter>>;

        try {
          // Only the network call is guarded. If the ack below were inside the
          // try, a failed delete would look like a transient network error and
          // the row would be sent again after the server had already applied it.
          result = await incrementCounter({
            increment: row.increment,
            mutationId: row.mutationId,
          });
        } catch {
          await recordAttempt(row.id, row.attempts);
          break;
        }

        await (result.status === 'ok'
          ? ackIncrement(row.id)
          : rejectIncrement(row.id, result.reason));
      }
    });

    await refresh();
  }, [refresh]);

  const submit = useCallback(
    async (increment: number) => {
      const mutationId = crypto.randomUUID();

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueueIncrement(increment, mutationId);
        await refresh();

        return;
      }

      try {
        const result = await incrementCounter({ increment, mutationId });

        if (result.status === 'ok') {
          await refresh();

          return;
        }

        // Refused, not unreachable. Queue it and mark it rejected so the user
        // sees a failure rather than a write that quietly vanished.
        await enqueueIncrement(increment, mutationId);
        const queued = await listSendable();
        const row = queued.find((candidate) => candidate.mutationId === mutationId);

        if (row?.id !== undefined) {
          await rejectIncrement(row.id, result.reason);
        }

        await refresh();
      } catch {
        // navigator.onLine only reports a link, not reachability. A captive
        // portal or a dead origin lands here, so queue rather than drop.
        await enqueueIncrement(increment, mutationId);
        await refresh();
      }
    },
    [refresh],
  );

  const discard = useCallback(async () => {
    await discardRejected();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    // `refresh` has no dependencies, so `flush` is identity-stable and this
    // runs once per mount rather than on every render. Keep the useCallbacks.
    void flush();

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

  return { pending, rejected, submit, discard };
}
