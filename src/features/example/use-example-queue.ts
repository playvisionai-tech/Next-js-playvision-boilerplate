'use client';

import type * as z from 'zod';
import type { SendResult } from '@/lib/offline-queue/use-offline-queue';
import { useOfflineQueue } from '@/lib/offline-queue/use-offline-queue';
import type { noteInputSchema } from './schema';
import { addNote, wasApplied } from './server/mutations';

/** What one queued row carries. The mutation id is the queue's, not ours. */
type Note = z.infer<typeof noteInputSchema>;

/** Names this feature's rows in the shared store, and its flush lock. */
const QUEUE = 'example';

/**
 * Sends one queued note.
 *
 * A transport failure throws straight through, which is what tells the queue
 * the write may still have landed. Only `invalid` — the server refusing the
 * payload — is reported as a rejection, because retrying a refusal cannot help.
 *
 * @param payload The note this row queued.
 * @param mutationId Client-generated id making the write idempotent.
 * @returns Whether the server accepted or refused the write.
 */
async function send(payload: Note, mutationId: string): Promise<SendResult> {
  const result = await addNote({ body: payload.body, mutationId });

  return result.status === 'ok' ? { status: 'ok' } : { status: 'rejected', reason: result.reason };
}

/**
 * Binds the offline write queue to this slice's mutation and its idempotency
 * check.
 *
 * `send` and `wasApplied` are module-level so the hook's callbacks stay
 * identity-stable across renders. See `src/lib/offline-queue/spec.md` for what
 * the queue guarantees and what it expects back.
 *
 * @returns Pending and rejected counts, a submit function, and discard and retry actions.
 */
export function useExampleQueue() {
  return useOfflineQueue<Note>({ queue: QUEUE, send, wasApplied });
}
