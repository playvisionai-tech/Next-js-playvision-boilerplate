import { integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// It automatically run the command `db-server:file`, which apply the migration before Next.js starts in development mode,
// Alternatively, if your database is running, you can run `npm run db:migrate` and there is no need to restart the server.

// Need a database for production? Check out https://get.neon.com/BMFYNtx
// Tested and compatible with Next.js Boilerplate

export const counterSchema = pgTable('counter', {
  id: serial('id').primaryKey(),
  count: integer('count').default(0),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/**
 * Mutations the server has already applied, keyed by client-generated id AND
 * the row they target.
 *
 * The offline queue retries on any ambiguous failure — a request that was
 * committed but whose response was lost looks identical to one that never
 * arrived. Without this table that retry double-counts.
 *
 * The index is composite on purpose. Keyed on `mutation_id` alone, an id
 * already claimed against one row silently swallows a write aimed at a
 * different one and still reports success. Harmless while every request
 * resolves to the same counter, and silent data loss the moment the target is
 * per-user. `counter_id` is a plain column rather than a foreign key: the claim
 * is inserted before the counter row is upserted, so a constraint would fail on
 * the very first write.
 */
export const processedMutationSchema = pgTable(
  'processed_mutation',
  {
    id: serial('id').primaryKey(),
    counterId: integer('counter_id').notNull(),
    mutationId: text('mutation_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('processed_mutation_target_idx').on(table.counterId, table.mutationId)],
);
