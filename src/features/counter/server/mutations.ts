'use server';

import 'server-only';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { counterSchema } from '@/lib/db/schema';
import { logger } from '@/lib/observability/logger';
import { counterIncrementSchema } from '../schema';
import { resolveCounterId } from './counter-id';

export type IncrementResult = { status: 'ok'; count: number } | { status: 'invalid' };

/**
 * Increments the counter for this request.
 *
 * The input is re-validated here even though the form already validated it:
 * a Server Action's arguments are a public endpoint, so client-side validation
 * is a convenience rather than a guarantee.
 *
 * @param input Unvalidated payload from the client.
 * @returns The new count, or an invalid marker when the payload fails Zod.
 */
export async function incrementCounter(input: unknown): Promise<IncrementResult> {
  const parsed = counterIncrementSchema.safeParse(input);

  if (!parsed.success) {
    return { status: 'invalid' };
  }

  const id = await resolveCounterId();

  const rows = await db
    .insert(counterSchema)
    .values({ id, count: parsed.data.increment })
    .onConflictDoUpdate({
      target: counterSchema.id,
      set: { count: sql`${counterSchema.count} + ${parsed.data.increment}` },
    })
    .returning();

  logger.info('Counter has been incremented');

  revalidatePath('/[locale]/counter', 'page');

  return { status: 'ok', count: rows[0]?.count ?? 0 };
}
