import 'server-only';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { exampleNoteSchema } from '@/lib/db/schema';

/** How many notes the view shows. */
const PAGE_SIZE = 10;

/**
 * Reads the most recent notes.
 *
 * This module deliberately carries no `'use server'`: the directive is
 * file-level, so it would turn every export here into a public HTTP endpoint.
 * Reads stay internal and are called by Server Components; only
 * `server/mutations.ts` is reachable from a browser.
 *
 * @returns The newest notes, most recent first.
 */
export async function listNotes() {
  return await db.query.exampleNoteSchema.findMany({
    orderBy: desc(exampleNoteSchema.id),
    limit: PAGE_SIZE,
  });
}
