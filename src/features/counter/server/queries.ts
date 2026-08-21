import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { counterSchema } from '@/lib/db/schema';
import { logger } from '@/lib/observability/logger';
import { resolveCounterId } from './counter-id';

/**
 * Reads the current count for this request.
 *
 * @returns The stored count, or 0 when the row does not exist yet.
 */
export async function getCurrentCount() {
  const id = await resolveCounterId();

  const result = await db.query.counterSchema.findFirst({
    where: eq(counterSchema.id, id),
  });

  logger.info('Counter fetched successfully');

  return result?.count ?? 0;
}
