'use server';

import 'server-only';
import { and, eq } from 'drizzle-orm';
import * as z from 'zod';
import { db } from '@/lib/db/client';
import { processedMutationSchema } from '@/lib/db/schema';
import { resolveCounterId } from './counter-id';

const mutationIdSchema = z.uuid();

/**
 * Reports whether a queued write already reached the database.
 *
 * A client that lost the response to `incrementCounter` cannot tell a request
 * that never arrived from one that committed and went unacknowledged. This is
 * the only way to find out, so the queue can retire a write instead of
 * reporting a failure that may not have happened.
 *
 * The counter row is resolved here rather than accepted from the caller, and
 * the lookup uses both columns because `processed_mutation_target_idx` is
 * composite: an id is only "applied" against the row it was claimed for.
 *
 * @param mutationId Client-generated id of the write in question.
 * @returns True when the mutation is recorded as applied for this counter row.
 */
export async function wasApplied(mutationId: string) {
  const parsed = mutationIdSchema.safeParse(mutationId);

  if (!parsed.success) {
    return false;
  }

  const id = await resolveCounterId();

  const claim = await db.query.processedMutationSchema.findFirst({
    where: and(
      eq(processedMutationSchema.counterId, id),
      eq(processedMutationSchema.mutationId, parsed.data),
    ),
  });

  return claim !== undefined;
}
