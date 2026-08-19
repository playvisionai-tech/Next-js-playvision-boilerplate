'use server';

import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { counterSchema, processedMutationSchema } from '@/lib/db/schema';
import { logger } from '@/lib/observability/logger';
import { counterIncrementSchema } from '../schema';
import { resolveCounterId } from './counter-id';

export type IncrementResult =
  | { status: 'ok'; count: number; replayed: boolean }
  | { status: 'invalid'; reason: string };

/**
 * Increments the counter for this request, at most once per mutation id.
 *
 * The input is re-validated here even though the form already validated it: a
 * Server Action's arguments are a public endpoint, so client-side validation is
 * a convenience rather than a guarantee.
 *
 * Idempotency comes from inserting the mutation id under a unique index in the
 * same transaction as the update. A replay inserts nothing, applies nothing,
 * and reports the current count — so a client retrying after a lost response
 * cannot double-count.
 *
 * @param input Unvalidated payload from the client.
 * @returns The resulting count, or an invalid marker with a reason.
 */
export async function incrementCounter(input: unknown): Promise<IncrementResult> {
  const parsed = counterIncrementSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: 'invalid',
      reason: parsed.error.issues.map((issue) => issue.message).join('; '),
    };
  }

  const id = await resolveCounterId();
  const { increment, mutationId } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const claimed = await tx
      .insert(processedMutationSchema)
      .values({ mutationId })
      .onConflictDoNothing()
      .returning({ mutationId: processedMutationSchema.mutationId });

    if (claimed.length === 0) {
      const existing = await tx.query.counterSchema.findFirst({
        where: eq(counterSchema.id, id),
      });

      return { count: existing?.count ?? 0, replayed: true };
    }

    const rows = await tx
      .insert(counterSchema)
      .values({ id, count: increment })
      .onConflictDoUpdate({
        target: counterSchema.id,
        set: { count: sql`${counterSchema.count} + ${increment}` },
      })
      .returning();

    return { count: rows[0]?.count ?? 0, replayed: false };
  });

  logger.info(result.replayed ? 'Counter increment replayed' : 'Counter has been incremented');

  revalidatePath('/[locale]/counter', 'page');

  return { status: 'ok', count: result.count, replayed: result.replayed };
}
