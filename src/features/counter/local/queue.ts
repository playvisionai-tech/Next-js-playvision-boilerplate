import 'client-only';
import { announceChange, localDb } from '@/lib/local-db/client';

/** Transient failures tolerated before a row is treated as permanently failed. */
export const MAX_ATTEMPTS = 5;

/**
 * Queues an increment that has not reached the server.
 *
 * A write dropped because the network was down is worse than a visible
 * failure: the user believes it saved.
 *
 * @param increment How much to add.
 * @param mutationId Client-generated id making the eventual write idempotent.
 * @returns Resolves once the write is durable.
 */
export async function enqueueIncrement(increment: number, mutationId: string) {
  await localDb.pendingIncrements.add({
    increment,
    mutationId,
    queuedAt: Date.now(),
    attempts: 0,
  });
  announceChange('pendingIncrements');
}

/**
 * Rows still worth sending, oldest first.
 *
 * Rows are NOT removed here. Deleting before the server confirms is how a
 * queue loses writes when the tab closes mid-flush.
 *
 * @returns Queued rows that have not failed permanently.
 */
export async function listSendable() {
  const rows = await localDb.pendingIncrements.orderBy('queuedAt').toArray();

  return rows.filter((row) => row.rejectedReason === undefined);
}

/**
 * Counts rows still waiting to be sent.
 *
 * @returns How many increments are pending.
 */
export async function countPending() {
  const sendable = await listSendable();

  return sendable.length;
}

/**
 * Counts rows that failed permanently and need the user's attention.
 *
 * @returns How many increments were rejected.
 */
export async function countRejected() {
  return await localDb.pendingIncrements.filter((row) => row.rejectedReason !== undefined).count();
}

/**
 * Removes a row the server has confirmed.
 *
 * @param id Primary key of the confirmed row.
 * @returns Resolves once the row is gone.
 */
export async function ackIncrement(id: number) {
  await localDb.pendingIncrements.delete(id);
  announceChange('pendingIncrements');
}

/**
 * Records a transient failure so a row cannot retry forever.
 *
 * A permanently failing write — a stale action id after a deploy, say — would
 * otherwise sit at the head of the queue and be retried on every reconnect.
 *
 * @param id Primary key of the failed row.
 * @param attempts Attempts made so far, before this one.
 * @returns Resolves once the row is updated.
 */
export async function recordAttempt(id: number, attempts: number) {
  const next = attempts + 1;

  await localDb.pendingIncrements.update(
    id,
    next >= MAX_ATTEMPTS ? { attempts: next, rejectedReason: 'unreachable' } : { attempts: next },
  );
  announceChange('pendingIncrements');
}

/**
 * Marks a row as permanently failed, keeping it visible.
 *
 * Deleting a rejected write silently is the same sin as dropping one on a dead
 * network: the badge clears and the user concludes it saved.
 *
 * @param id Primary key of the rejected row.
 * @param reason Why the server refused it.
 * @returns Resolves once the row is updated.
 */
export async function rejectIncrement(id: number, reason: string) {
  await localDb.pendingIncrements.update(id, { rejectedReason: reason });
  announceChange('pendingIncrements');
}

/**
 * Discards every permanently failed row.
 *
 * @returns Resolves once they are gone.
 */
export async function discardRejected() {
  const rejected = await localDb.pendingIncrements
    .filter((row) => row.rejectedReason !== undefined)
    .toArray();

  await localDb.pendingIncrements.bulkDelete(
    rejected.map((row) => row.id).filter((id): id is number => id !== undefined),
  );
  announceChange('pendingIncrements');
}
