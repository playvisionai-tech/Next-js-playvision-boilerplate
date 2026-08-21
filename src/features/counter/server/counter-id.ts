import 'server-only';
import { headers } from 'next/headers';

/**
 * Resolves which counter row this request belongs to.
 *
 * End-to-end runs send `x-e2e-random-id` so concurrent tests increment
 * different rows instead of fighting over one. Without the header every
 * request shares row 0.
 *
 * @returns The counter row id for the current request.
 */
export async function resolveCounterId() {
  const headersList = await headers();

  return Number(headersList.get('x-e2e-random-id')) || 0;
}
