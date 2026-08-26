import { describe, expect, it } from 'vitest';
import { ApiError } from '../client';
import { createApiQueryClient } from '../query';

/**
 * Reads the retry predicate off a freshly built client.
 *
 * @returns The default `retry` option, as the function it is configured to be.
 */
function retryPredicate() {
  const retry = createApiQueryClient().getDefaultOptions().queries?.retry;

  if (typeof retry !== 'function') {
    throw new TypeError('The query client no longer decides retries with a predicate');
  }

  return retry as (failureCount: number, error: Error) => boolean;
}

const transient = new ApiError('gateway', { status: 503, retryable: true });
const refusal = new ApiError('not found', { status: 404, retryable: false });

describe('Query client defaults', () => {
  it('serves a fetched value for a minute before refetching in the background', () => {
    expect(createApiQueryClient().getDefaultOptions().queries?.staleTime).toBe(60_000);
  });

  it('retries a failure that could plausibly succeed on a second ask', () => {
    expect(retryPredicate()(0, transient)).toBeTruthy();
  });

  it('gives up on a transient failure rather than hammering a struggling origin', () => {
    expect(retryPredicate()(2, transient)).toBeFalsy();
  });

  it('never retries a deterministic refusal, because the answer cannot change', () => {
    expect(retryPredicate()(0, refusal)).toBeFalsy();
  });

  // Everything reaching a query function goes through apiFetch, which throws
  // ApiError and nothing else. An error of any other type came from our own
  // code, and repeating it just runs the bug again.
  it('does not retry an error that did not come from the transport', () => {
    expect(retryPredicate()(0, new Error('undefined is not a function'))).toBeFalsy();
  });
});
