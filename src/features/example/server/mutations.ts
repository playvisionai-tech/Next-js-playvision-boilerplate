'use server';

import 'server-only';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { db } from '@/lib/db/client';
import { exampleNoteSchema } from '@/lib/db/schema';
import { noteSchema } from '../schema';

export type AddNoteResult = { status: 'ok' } | { status: 'invalid'; reason: string };

const mutationIdSchema = z.uuid();

/**
 * Stores one note, at most once per mutation id.
 *
 * The input is re-validated here even though the form already validated it: a
 * Server Action's arguments are a public endpoint, so client-side validation is
 * a convenience rather than a guarantee.
 *
 * Idempotency comes from the unique index on `mutation_id`. A replay inserts
 * nothing and still reports success, so a queue retrying after a lost response
 * cannot duplicate the note.
 *
 * @param input Unvalidated payload from the client.
 * @returns Whether the write was accepted, or refused with a reason.
 */
export async function addNote(input: unknown): Promise<AddNoteResult> {
  const parsed = noteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: 'invalid',
      reason: parsed.error.issues.map((issue) => issue.message).join('; '),
    };
  }

  const { body, mutationId } = parsed.data;

  await db
    .insert(exampleNoteSchema)
    .values({ body, mutationId })
    .onConflictDoNothing({ target: exampleNoteSchema.mutationId });

  revalidatePath('/[locale]/example', 'page');

  return { status: 'ok' };
}

/**
 * Reports whether a queued write already reached the database.
 *
 * A client that lost the response to `addNote` cannot tell a request that never
 * arrived from one that committed and went unacknowledged. This is the only way
 * to find out, so the queue can retire a write instead of reporting a failure
 * that may not have happened.
 *
 * It lives beside the write rather than in `queries.ts` because `'use server'`
 * is file-level: every export of this module is a public endpoint, and both of
 * these are safe to expose. Putting it in `queries.ts` would have exposed the
 * reads too.
 *
 * @param mutationId Client-generated id of the write in question.
 * @returns True when a note with that mutation id is already stored.
 */
export async function wasApplied(mutationId: string) {
  const parsed = mutationIdSchema.safeParse(mutationId);

  if (!parsed.success) {
    return false;
  }

  const note = await db.query.exampleNoteSchema.findFirst({
    where: eq(exampleNoteSchema.mutationId, parsed.data),
  });

  return note !== undefined;
}
