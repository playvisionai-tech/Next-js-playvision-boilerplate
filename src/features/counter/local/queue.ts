import 'client-only';
import { announceChange, localDb } from '@/lib/local-db/client';

/**
 * Queues an increment that could not reach the server.
 *
 * A write dropped because the network was down is worse than a visible
 * failure: the user believes it saved.
 *
 * @param increment How much to add once connectivity returns.
 * @returns Resolves once the write is durable.
 */
export async function enqueueIncrement(increment: number) {
  await localDb.pendingIncrements.add({ increment, queuedAt: Date.now() });
  announceChange('pendingIncrements');
}

/**
 * Counts queued increments.
 *
 * @returns The number of increments waiting to be sent.
 */
export async function countPending() {
  return await localDb.pendingIncrements.count();
}

/**
 * Removes and returns everything queued, oldest first.
 *
 * Taking the rows out before sending them means a failed flush loses the
 * queue, so the caller re-queues on failure rather than leaving duplicates.
 *
 * @returns The increments that were queued, in the order they were made.
 */
export async function drainPending() {
  const rows = await localDb.pendingIncrements.orderBy('queuedAt').toArray();
  await localDb.pendingIncrements.clear();
  announceChange('pendingIncrements');

  return rows.map((row) => row.increment);
}
