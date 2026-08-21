import * as z from 'zod';

/**
 * What the user actually types. The form validates against this.
 */
export const noteInputSchema = z.object({
  body: z.string().trim().min(1).max(80),
});

/**
 * What the Server Action accepts: the user's input plus a client-generated
 * mutation id that makes the write idempotent.
 *
 * The id is not user input, so it is deliberately absent from the form schema —
 * including it there would fail validation before the submit handler ever runs.
 *
 * This module is the one thing crossing the server/client boundary, so it must
 * never import anything server-only or client-only.
 */
export const noteSchema = noteInputSchema.extend({
  mutationId: z.uuid(),
});
