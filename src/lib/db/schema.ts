import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `pnpm db:generate`

// The generated migration file will reflect your schema changes.
// It automatically runs the command `db-server:file`, which applies the migration before Next.js starts in development mode,
// Alternatively, if your database is running, you can run `pnpm db:migrate` and there is no need to restart the server.

// Need a database for production? Check out https://get.neon.com/BMFYNtx

/**
 * Belongs to `src/features/example/` and goes when that slice does — see its
 * `spec.md`. It is the only table here, so a new project starts from an empty
 * schema once the reference slice is deleted.
 *
 * `mutation_id` is unique, and that single constraint does two jobs. It makes
 * `addNote` idempotent — the offline queue retries on any ambiguous failure,
 * and a request that committed but whose response was lost is indistinguishable
 * from one that never arrived — and it is what `wasApplied` reads to answer
 * whether a queued write already landed.
 */
export const exampleNoteSchema = pgTable('example_note', {
  id: serial('id').primaryKey(),
  body: text('body').notNull(),
  mutationId: text('mutation_id').notNull().unique(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
