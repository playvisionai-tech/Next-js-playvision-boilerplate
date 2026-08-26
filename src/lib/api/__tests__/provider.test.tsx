import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { ApiError } from '../client';
import { ApiProvider } from '../provider';
import type { ApiQuery } from '../query';
import { useApiQuery } from '../query';

const Probe = (props: { query: ApiQuery<string> }) => {
  const { data, error, isPending } = useApiQuery(props.query);

  if (isPending) {
    return <span>loading</span>;
  }

  return <span>{error ? `error:${error.message}` : `data:${data}`}</span>;
};

/**
 * A query function with no implementation of its own.
 *
 * @returns A spy whose resolved or rejected value each test sets.
 */
const stubQueryFn = () => vi.fn<() => Promise<string>>();

const resolving: ApiQuery<string> = {
  queryKey: ['probe'],
  queryFn: stubQueryFn().mockResolvedValue('warm'),
};

describe('Api provider', () => {
  it('renders its children rather than swallowing them', async () => {
    await render(
      <ApiProvider>
        <p>Page content</p>
      </ApiProvider>,
    );

    await expect.element(page.getByText('Page content')).toBeVisible();
  });

  it('serves a resolved value to a consumer below it', async () => {
    await render(
      <ApiProvider>
        <Probe query={resolving} />
      </ApiProvider>,
    );

    await expect.element(page.getByText('data:warm')).toBeVisible();
  });

  it('reports a failure as an error rather than a permanent skeleton', async () => {
    const query: ApiQuery<string> = {
      queryKey: ['probe', 'failing'],
      queryFn: stubQueryFn().mockRejectedValue(
        new ApiError('refused', { status: 404, retryable: false }),
      ),
    };

    await render(
      <ApiProvider>
        <Probe query={query} />
      </ApiProvider>,
    );

    await expect.element(page.getByText('error:refused')).toBeVisible();
  });

  // The client is created per mount, in state. A module-scope client would be
  // shared across every render the server performs, which is one request's
  // cache answering another's.
  it('gives each mount its own cache', async () => {
    const queryFn = stubQueryFn().mockResolvedValue('warm');
    const query: ApiQuery<string> = { queryKey: ['probe', 'per-mount'], queryFn };

    await render(
      <div>
        <ApiProvider>
          <Probe query={query} />
        </ApiProvider>
        <ApiProvider>
          <Probe query={query} />
        </ApiProvider>
      </div>,
    );

    await expect.element(page.getByText('data:warm').first()).toBeVisible();
    await expect.element(page.getByText('data:warm').nth(1)).toBeVisible();

    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
