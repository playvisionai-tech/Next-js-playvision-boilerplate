import type * as z from 'zod';

/**
 * How long a third-party call may take before we stop waiting.
 *
 * A request with no ceiling is a spinner with no end: the browser's own default
 * is minutes, and a hook that never settles renders a skeleton forever.
 */
const REQUEST_TIMEOUT_MS = 8000;

/** Lowest status that describes a fault on their side rather than in our request. */
const SERVER_ERROR_STATUS = 500;

type ApiErrorOptions = {
  /** HTTP status, or null when no response arrived at all. */
  status: number | null;
  /** Whether repeating the identical request could plausibly succeed. */
  retryable: boolean;
  cause?: unknown;
};

/**
 * A call to a third-party API that produced nothing usable.
 *
 * `retryable` is the field that matters, and it is decided here rather than at
 * the call site: a 4xx and a response that does not match its schema are
 * deterministic refusals, so repeating them cannot help. The same distinction
 * `src/features/example` draws for its own queued writes.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, options: ApiErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

/**
 * Fetches JSON from a third-party origin and validates it before returning it.
 *
 * The single place in `src/` that calls `fetch` against someone else's server.
 * Everything it guarantees — a timeout, a typed failure, and a body that has
 * been checked against a schema — is a guarantee a call site cannot forget.
 *
 * An unvalidated response is the interesting one: a third party is free to
 * change a field's type without telling us, and without the parse that lands as
 * `undefined` deep inside a component rather than as an error at the boundary.
 *
 * @param url Absolute URL, including its query string.
 * @param schema Zod schema the response body must satisfy.
 * @param options Optional caller signal, aborted alongside the timeout.
 * @returns The parsed body, typed by the schema.
 * @throws ApiError When the request, the status, the body or the schema fails.
 */
export async function apiFetch<TSchema extends z.ZodType>(
  url: string,
  schema: TSchema,
  options?: { signal?: AbortSignal },
): Promise<z.output<TSchema>> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  // The caller's signal is react-query cancelling a query that no longer has a
  // consumer. Either one ending the request is correct.
  const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;

  try {
    response = await fetch(url, { signal, headers: { accept: 'application/json' } });
  } catch (error) {
    throw new ApiError(`Request to ${url} did not complete`, {
      status: null,
      retryable: true,
      cause: error,
    });
  }

  if (!response.ok) {
    throw new ApiError(`Request to ${url} returned ${response.status}`, {
      status: response.status,
      retryable: response.status >= SERVER_ERROR_STATUS,
    });
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch (error) {
    throw new ApiError(`Response from ${url} was not JSON`, {
      status: response.status,
      retryable: false,
      cause: error,
    });
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(`Response from ${url} did not match its schema`, {
      status: response.status,
      retryable: false,
      cause: parsed.error,
    });
  }

  return parsed.data;
}
