import * as z from 'zod';

/**
 * The one module that crosses the server/client boundary: the form validates
 * with it in the browser, and the Server Action re-validates with it on the
 * server. It must never import anything server-only or client-only.
 */
export const counterIncrementSchema = z.object({
  increment: z.number().min(1).max(3),
});
