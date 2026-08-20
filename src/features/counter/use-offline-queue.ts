'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LOCAL_DB_CHANNEL } from '@/lib/local-db/client';
import {
  ackIncrement,
  countPending,
  countRejected,
  discardRejected,
  enqueueIncrement,
  listSendable,
  MAX_ATTEMPTS,
  recordAttempt,
  rejectIncrement,
  retryRejected,
} from './local/queue';
import { wasApplied } from './server/mutation-status';
import { incrementCounter } from './server/mutations';

const FLUSH_LOCK = 'counter-flush';

/** First backoff wait after a flush leaves something behind. */
const RETRY_BASE_MS = 2000;
/** Ceiling for the backoff, so a long outage still retries about twice a minute. */
const RETRY_MAX_MS = 30_000;

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
 * @returns Pending and rejected counts, a submit function, and discard and retry actions.
 */
export function useOfflineQueue() {
  const [pending, setPending] = useState(0);
  const [rejected, setRejected] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(RETRY_BASE_MS);
  const flushRef = useRef<(() => Promise<void>) | null>(null);

  const refresh = useCallback(async () => {
    setPending(await countPending());
    setRejected(await countRejected());
  }, []);

  const cancelRetry = useCallback(() => {
    if (retryTimer.current !== null) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    cancelRetry();

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
          const attempts = await recordAttempt(row.id, row.attempts);

          if (attempts < MAX_ATTEMPTS) {
            break;
          }

          // Out of attempts is not the same as not applied: the request may
          // have committed and only the response been lost. The idempotency
          // table is the only thing that knows, so ask it before telling the
          // user the write failed.
          let applied: boolean;

          try {
            applied = await wasApplied(row.mutationId);
          } catch {
            // Still unknown. Leaving it pending keeps retrying, which is safe
            // because the write is idempotent; rejecting it here would be a
            // guess presented to the user as a fact.
            break;
          }

          if (applied) {
            await ackIncrement(row.id);
            continue;
          }

          await rejectIncrement(row.id, 'unreachable');
          continue;
        }

        await (result.status === 'ok'
          ? ackIncrement(row.id)
          : rejectIncrement(row.id, result.reason));
      }

      // Scheduled inside the lock so the browser runs one retry timer rather
      // than one per open tab, all waking together against an origin that is
      // already struggling.
      if ((await countPending()) > 0) {
        retryTimer.current = setTimeout(() => {
          void flushRef.current?.();
        }, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, RETRY_MAX_MS);
      } else {
        retryDelay.current = RETRY_BASE_MS;
      }
    });

    await refresh();
  }, [cancelRetry, refresh]);

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
          // The origin just answered, which is the only reliable evidence it is
          // reachable. `online` fires for the network interface, not for a
          // server that was down, so this is what drains a backlog behind it.
          await flush();

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
        // Not to send it again — that just failed — but so the backoff timer
        // exists. Nothing else would start one: `online` never fires while the
        // interface was up the whole time, and mount has already been and gone.
        await flush();
      }
    },
    [flush, refresh],
  );

  const discard = useCallback(async () => {
    await discardRejected();
    await refresh();
  }, [refresh]);

  const retry = useCallback(async () => {
    await retryRejected();
    await refresh();
    await flush();
  }, [flush, refresh]);

  useEffect(() => {
    // `refresh` has no dependencies, so `flush` is identity-stable and this
    // runs once per mount rather than on every render. Keep the useCallbacks.
    flushRef.current = flush;
    void flush();

    const onOnline = () => {
      void flush();
    };

    // A tab that was backgrounded through an outage has a stale backoff and no
    // reason to have noticed the origin come back. Returning to it is the
    // moment the user expects the badge to be right.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void flush();
      }
    };

    const channel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(LOCAL_DB_CHANNEL);
    const onMessage = () => {
      void refresh();
    };

    channel?.addEventListener('message', onMessage);
    globalThis.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelRetry();
      flushRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      globalThis.removeEventListener('online', onOnline);
      channel?.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [cancelRetry, flush, refresh]);

  return { pending, rejected, submit, discard, retry };
}
