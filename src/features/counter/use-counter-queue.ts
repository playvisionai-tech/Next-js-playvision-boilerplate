'use client';

import type * as z from 'zod';
import type { SendResult } from '@/lib/offline-queue/use-offline-queue';
import { useOfflineQueue } from '@/lib/offline-queue/use-offline-queue';
import type { counterIncrementInputSchema } from './schema';
import { wasApplied } from './server/mutation-status';
import { incrementCounter } from './server/mutations';

/** What one queued row carries. The mutation id is the queue's, not ours. */
type CounterIncrement = z.infer<typeof counterIncrementInputSchema>;

/** Names the counter's rows in the shared store, and its flush lock. */
const QUEUE = 'counter';

/**
 * Sends one queued increment.
 *
 * A transport failure throws straight through, which is what tells the queue
 * the write may still have landed. Only `invalid` — the server refusing the
 * payload — is reported as a rejection, because retrying a refusal cannot help.
 *
 * @param payload The increment this row queued.
 * @param mutationId Client-generated id making the write idempotent.
 * @returns Whether the server accepted or refused the write.
 */
async function send(payload: CounterIncrement, mutationId: string): Promise<SendResult> {
  const result = await incrementCounter({ increment: payload.increment, mutationId });

  return result.status === 'ok' ? { status: 'ok' } : { status: 'rejected', reason: result.reason };
}

/**
 * Binds the offline write queue to the counter's mutation and its idempotency
 * check.
 *
 * `send` and `wasApplied` are module-level so the hook's callbacks stay
 * identity-stable across renders.
 *
 * @returns Pending and rejected counts, a submit function, and discard and retry actions.
 */
export function useCounterQueue() {
  return useOfflineQueue<CounterIncrement>({ queue: QUEUE, send, wasApplied });
}
