'use client';

import 'client-only';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LOCAL_DB_CHANNEL } from '@/lib/local-db/client';
import {
  ackWrite,
  countPending,
  countRejected,
  discardRejected,
  enqueueWrite,
  listSendable,
  MAX_ATTEMPTS,
  recordAttempt,
  rejectWrite,
  retryRejected,
} from './store';

/** First backoff wait after a flush leaves something behind. */
const RETRY_BASE_MS = 2000;
/** Ceiling for the backoff, so a long outage still retries about twice a minute. */
const RETRY_MAX_MS = 30_000;

/**
 * What sending one queued write can report.
 *
 * There is a third answer, and it is the important one: throwing. It means the
 * write may or may not have arrived, which is what the confirmation rule below
 * exists for. A `rejected` result is the server refusing the payload, which is
 * a decision, not an accident.
 */
export type SendResult = { status: 'ok' } | { status: 'rejected'; reason: string };

type OfflineQueueOptions<TPayload> = {
  /** Names this feature's rows in the shared store, and its flush lock. */
  queue: string;
  /** Sends one queued write. Throws when it could not be delivered. */
  send: (payload: TPayload, mutationId: string) => Promise<SendResult>;
  /**
   * Answers whether the server already applied a mutation id. Throws when it
   * cannot say — which is not the same as answering no.
   */
  wasApplied: (mutationId: string) => Promise<boolean>;
};

/**
 * Runs a job under a browser-wide lock, or skips it if another tab holds one.
 *
 * `navigator.locks` is absent — not merely restricted — outside a secure
 * context, so plain-HTTP origins need the same feature detection the
 * BroadcastChannel helper uses. Without a lock the job still runs: React
 * StrictMode double-invokes effects in development, so this guards a single
 * tab as much as several.
 *
 * @param queue Queue whose lock to take, so two queues never block each other.
 * @param job Work that must happen at most once per browser at a time.
 * @returns Resolves once the job has run, or immediately if another holder has it.
 */
async function withFlushLock(queue: string, job: () => Promise<void>) {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) {
    await job();

    return;
  }

  await navigator.locks.request(`offline-queue-${queue}`, { ifAvailable: true }, async (lock) => {
    if (lock) {
      await job();
    }
  });
}

/**
 * Keeps a feature's offline write queue in sync with the server.
 *
 * @param props Queue name, the send function, and the applied-yet check.
 * @returns Pending and rejected counts, a submit function, and discard and retry actions.
 */
export function useOfflineQueue<TPayload>(props: OfflineQueueOptions<TPayload>) {
  const [pending, setPending] = useState(0);
  const [rejected, setRejected] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(RETRY_BASE_MS);
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  // The caller's options are read through a ref so every callback below can
  // keep an empty dependency list. Identity-stable callbacks are what make the
  // drain effect run once per mount rather than on every render, and a caller
  // passing an inline arrow function must not be able to break that.
  const optionsRef = useRef(props);

  // Declared before the drain effect, so the ref is current by the time
  // anything below reads it.
  useEffect(() => {
    optionsRef.current = props;
  });

  const refresh = useCallback(async () => {
    const { queue } = optionsRef.current;

    setPending(await countPending(queue));
    setRejected(await countRejected(queue));
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

    const { queue, send, wasApplied } = optionsRef.current;

    await withFlushLock(queue, async () => {
      for (const row of await listSendable<TPayload>(queue)) {
        if (row.id === undefined) {
          continue;
        }

        let result: SendResult;

        try {
          // Only the network call is guarded. If the ack below were inside the
          // try, a failed delete would look like a transient network error and
          // the row would be sent again after the server had already applied it.
          result = await send(row.payload, row.mutationId);
        } catch {
          const attempts = await recordAttempt(row.id, row.attempts);

          if (attempts < MAX_ATTEMPTS) {
            break;
          }

          // Out of attempts is not the same as not applied: the request may
          // have committed and only the response been lost. The server is the
          // only thing that knows, so ask it before telling the user the write
          // failed.
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
            await ackWrite(row.id);
            continue;
          }

          await rejectWrite(row.id, 'unreachable');
          continue;
        }

        await (result.status === 'ok' ? ackWrite(row.id) : rejectWrite(row.id, result.reason));
      }

      // Scheduled inside the lock so the browser runs one retry timer rather
      // than one per open tab, all waking together against an origin that is
      // already struggling.
      if ((await countPending(queue)) > 0) {
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
    async (payload: TPayload) => {
      const { queue, send } = optionsRef.current;
      const mutationId = crypto.randomUUID();

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueueWrite({ queue, payload, mutationId });
        await refresh();

        return;
      }

      try {
        const result = await send(payload, mutationId);

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
        await enqueueWrite({ queue, payload, mutationId });
        const queued = await listSendable<TPayload>(queue);
        const row = queued.find((candidate) => candidate.mutationId === mutationId);

        if (row?.id !== undefined) {
          await rejectWrite(row.id, result.reason);
        }

        await refresh();
      } catch {
        // navigator.onLine only reports a link, not reachability. A captive
        // portal or a dead origin lands here, so queue rather than drop.
        await enqueueWrite({ queue, payload, mutationId });
        // Not to send it again — that just failed — but so the backoff timer
        // exists. Nothing else would start one: `online` never fires while the
        // interface was up the whole time, and mount has already been and gone.
        await flush();
      }
    },
    [flush, refresh],
  );

  const discard = useCallback(async () => {
    await discardRejected(optionsRef.current.queue);
    await refresh();
  }, [refresh]);

  const retry = useCallback(async () => {
    await retryRejected(optionsRef.current.queue);
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
