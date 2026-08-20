import * as z from 'zod';

/**
 * What the user actually types. The form validates against this.
 */
export const counterIncrementInputSchema = z.object({
  // .int() matters: the column is an integer, and without it a fractional
  // value was stopped only by the browser's implicit step=1 — which the form
  // now bypasses with noValidate.
  increment: z.number().int().min(1).max(3),
});

/**
 * What the Server Action accepts: the user's input plus a client-generated
 * mutation id that makes the write idempotent.
 *
 * The id is not user input, so it is deliberately absent from the form schema —
 * including it there would fail validation before the handler ever runs.
 *
 * This module is the one thing crossing the server/client boundary, so it must
 * never import anything server-only or client-only.
 */
export const counterIncrementSchema = counterIncrementInputSchema.extend({
  mutationId: z.uuid(),
});
