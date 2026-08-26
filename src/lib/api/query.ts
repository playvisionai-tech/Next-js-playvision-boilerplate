'use client';

import { QueryClient, useQuery } from '@tanstack/react-query';
import { ApiError } from './client';

/**
 * How long a fetched value is served without a background refetch.
 *
 * Zero — react-query's own default — refetches on every mount, on every window
 * focus, and on every reconnect, which turns a cache into a fetch-on-render
 * hook with extra steps. A minute is the floor; a resource that changes more
 * slowly says so in its own query.
 */
const DEFAULT_STALE_TIME_MS = 60_000;

/** Attempts after the first, for failures that are worth repeating at all. */
const MAX_RETRIES = 2;

/**
 * One query against a third-party API.
 *
 * Deliberately narrower than react-query's options object: a query declares
 * what to fetch and how stale it may get, and nothing else. Defaults are the
 * client's job, not the call site's.
 */
export type ApiQuery<TData> = {
  queryKey: readonly unknown[];
  queryFn: (context: { signal: AbortSignal }) => Promise<TData>;
  staleTime?: number;
};

/**
 * What a component gets back. Five fields, all of them renderable.
 *
 * `isPending` is "there is nothing to show yet"; `isFetching` is "a request is
 * in flight", which is also true while cached data is being refreshed. A card
 * that confuses them either flashes a skeleton over data it already has or
 * never tells the user it is updating.
 */
export type ApiQueryResult<TData> = {
  data: TData | undefined;
  error: Error | null;
  isPending: boolean;
  isFetching: boolean;
  refetch: () => void;
};

/**
 * Builds the QueryClient with this app's defaults.
 *
 * Called from `provider.tsx` per mount, never at module scope: a module-scope
 * client is shared by every request the server renders, which is one user's
 * cache answering another user's render.
 *
 * @returns A QueryClient carrying the house defaults.
 */
export function createApiQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        // A deterministic refusal — a 4xx, or a body that does not match its
        // schema — cannot be fixed by asking again. Only transport failures and
        // 5xx are retried, and `apiFetch` is what decides which is which.
        retry: (failureCount, error) =>
          error instanceof ApiError && error.retryable && failureCount < MAX_RETRIES,
      },
    },
  });
}

/**
 * Reads a third-party resource in the browser.
 *
 * The only hook in this app that fetches during render, and the only import
 * site of react-query's hooks. Our own data does not come through here: it is
 * read by a Server Component and written by a Server Action, so that a fact the
 * database owns has exactly one path to the page.
 *
 * All five result fields are read on every render, which keeps react-query's
 * change tracking subscribed to the same set from the first render onwards.
 *
 * @param query The resource to read, from a `*Query()` factory in this module.
 * @returns The narrowed result, safe to render directly.
 */
export function useApiQuery<TData>(query: ApiQuery<TData>): ApiQueryResult<TData> {
  const result = useQuery(query);

  return {
    data: result.data,
    error: result.error,
    isPending: result.isPending,
    isFetching: result.isFetching,
    refetch: () => {
      void result.refetch();
    },
  };
}
