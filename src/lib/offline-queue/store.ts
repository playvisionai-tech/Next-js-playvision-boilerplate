import 'client-only';
import { announceChange, localDb } from '@/lib/local-db/client';

/** Transient failures tolerated before a row is treated as permanently failed. */
export const MAX_ATTEMPTS = 5;

/** The store every queue shares. Named once so the broadcasts agree with it. */
const STORE = 'pendingWrites';

/**
 * A queued write as the feature that owns it sees it: the queue's envelope
 * around that feature's own payload.
 *
 * The store keeps the payload opaque. Only the caller that queued a row knows
 * what is inside it, which is what lets one store serve every feature.
 */
type PendingWrite<TPayload> = {
  id?: number;
  payload: TPayload;
  /** Client-generated; makes the server-side write idempotent on retry. */
  mutationId: string;
  queuedAt: number;
  /** Transient failures so far. */
  attempts: number;
  /** Set when the write failed permanently. Kept so the user can see it. */
  rejectedReason?: string;
};

/**
 * Queues a write that has not reached the server.
 *
 * A write dropped because the network was down is worse than a visible
 * failure: the user believes it saved.
 *
 * @param props Queue name, the feature's payload, and the write's mutation id.
 * @returns Resolves once the write is durable.
 */
export async function enqueueWrite(props: { queue: string; payload: unknown; mutationId: string }) {
  await localDb.pendingWrites.add({
    queue: props.queue,
    payload: props.payload,
    mutationId: props.mutationId,
    queuedAt: Date.now(),
    attempts: 0,
  });
  announceChange(STORE);
}

/**
 * Rows still worth sending, oldest first.
 *
 * Rows are NOT removed here. Deleting before the server confirms is how a
 * queue loses writes when the tab closes mid-flush.
 *
 * @param queue Which queue's rows to read.
 * @returns Queued rows that have not failed permanently.
 */
export async function listSendable<TPayload>(queue: string) {
  const rows = await localDb.pendingWrites.where('queue').equals(queue).sortBy('queuedAt');

  // IndexedDB hands the payload back as `unknown`, because the store is shared
  // and holds no shape of its own. The caller asking for these rows is the one
  // that wrote them, so it is the only thing that can say what they are.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The payload is opaque storage I/O; the queue's owner declares its shape.
  return rows.filter((row) => row.rejectedReason === undefined) as PendingWrite<TPayload>[];
}

/**
 * Counts rows still waiting to be sent.
 *
 * @param queue Which queue's rows to count.
 * @returns How many writes are pending.
 */
export async function countPending(queue: string) {
  const sendable = await listSendable(queue);

  return sendable.length;
}

/**
 * Counts rows that failed permanently and need the user's attention.
 *
 * @param queue Which queue's rows to count.
 * @returns How many writes were rejected.
 */
export async function countRejected(queue: string) {
  return await localDb.pendingWrites
    .where('queue')
    .equals(queue)
    .filter((row) => row.rejectedReason !== undefined)
    .count();
}

/**
 * Removes a row the server has confirmed.
 *
 * @param id Primary key of the confirmed row.
 * @returns Resolves once the row is gone.
 */
export async function ackWrite(id: number) {
  await localDb.pendingWrites.delete(id);
  announceChange(STORE);
}

/**
 * Records a transient failure so the caller can tell a first miss from an
 * exhausted one.
 *
 * It deliberately does not reject at the cap. A lost response is
 * indistinguishable from a request that never arrived, so an attempt count is
 * evidence that sending failed, never evidence that the write did not apply.
 * Only the server knows that, and only the caller can ask it.
 *
 * @param id Primary key of the failed row.
 * @param attempts Attempts made so far, before this one.
 * @returns Attempts made including this one.
 */
export async function recordAttempt(id: number, attempts: number) {
  const next = attempts + 1;

  await localDb.pendingWrites.update(id, { attempts: next });
  announceChange(STORE);

  return next;
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
export async function rejectWrite(id: number, reason: string) {
  await localDb.pendingWrites.update(id, { rejectedReason: reason });
  announceChange(STORE);
}

/**
 * Discards every permanently failed row in a queue.
 *
 * @param queue Which queue to clear the rejections from.
 * @returns Resolves once they are gone.
 */
export async function discardRejected(queue: string) {
  const rejected = await localDb.pendingWrites
    .where('queue')
    .equals(queue)
    .filter((row) => row.rejectedReason !== undefined)
    .toArray();

  await localDb.pendingWrites.bulkDelete(
    rejected.map((row) => row.id).filter((id): id is number => id !== undefined),
  );
  announceChange(STORE);
}

/**
 * Returns every permanently failed row in a queue for another try.
 *
 * The attempt counter is reset as well as the reason: leaving it at the cap
 * would send each row once and reject it again on the first hiccup, which is
 * indistinguishable from the button doing nothing.
 *
 * @param queue Which queue to retry.
 * @returns Resolves once the rows are sendable again.
 */
export async function retryRejected(queue: string) {
  await localDb.pendingWrites
    .where('queue')
    .equals(queue)
    .filter((row) => row.rejectedReason !== undefined)
    .modify((row) => {
      row.attempts = 0;
      row.rejectedReason = undefined;
    });
  announceChange(STORE);
}
