import { afterEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import { ApiError, apiFetch } from '../client';

type FetchStub = (url: string, options: RequestInit) => Promise<Response>;

const schema = z.object({ value: z.number() });

const RESOURCE = 'https://api.example.test/thing';

/**
 * Stands in for one call to a third party.
 *
 * @param init Status and body the fake origin should answer with.
 */
function stubFetch(init: { status?: number; body?: unknown; raw?: string }) {
  const body = init.raw ?? JSON.stringify(init.body ?? {});
  const fetchSpy = vi.fn<FetchStub>();

  fetchSpy.mockResolvedValue(new Response(body, { status: init.status ?? 200 }));
  vi.stubGlobal('fetch', fetchSpy);
}

describe('Third-party fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed body when the response matches its schema', async () => {
    stubFetch({ body: { value: 21 } });

    await expect(apiFetch(RESOURCE, schema)).resolves.toStrictEqual({ value: 21 });
  });

  it('drops fields the schema does not declare, so no unread shape reaches a caller', async () => {
    stubFetch({ body: { value: 21, undocumented: 'ignore me' } });

    await expect(apiFetch(RESOURCE, schema)).resolves.toStrictEqual({ value: 21 });
  });

  it('fails when the third party changes a type, instead of returning undefined', async () => {
    stubFetch({ body: { value: 'warm' } });

    await expect(apiFetch(RESOURCE, schema)).rejects.toBeInstanceOf(ApiError);
  });

  it('does not retry a body that failed its schema: asking again returns the same body', async () => {
    stubFetch({ body: { value: 'warm' } });

    await expect(apiFetch(RESOURCE, schema)).rejects.toMatchObject({ retryable: false });
  });

  it('does not retry a 4xx, which is the server refusing this exact request', async () => {
    stubFetch({ status: 404 });

    await expect(apiFetch(RESOURCE, schema)).rejects.toMatchObject({
      status: 404,
      retryable: false,
    });
  });

  it('retries a 5xx, which may be transient', async () => {
    stubFetch({ status: 503 });

    await expect(apiFetch(RESOURCE, schema)).rejects.toMatchObject({
      status: 503,
      retryable: true,
    });
  });

  it('reports a request that never got a response as retryable, with no status', async () => {
    const fetchSpy = vi.fn<FetchStub>();

    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(apiFetch(RESOURCE, schema)).rejects.toMatchObject({
      status: null,
      retryable: true,
    });
  });

  it('fails on a 200 that is not JSON at all', async () => {
    stubFetch({ raw: '<html>maintenance</html>' });

    await expect(apiFetch(RESOURCE, schema)).rejects.toMatchObject({ retryable: false });
  });

  it('passes the caller signal through, so a cancelled query cancels its request', async () => {
    const fetchSpy = vi.fn<FetchStub>();

    fetchSpy.mockResolvedValue(new Response('{"value":1}'));
    vi.stubGlobal('fetch', fetchSpy);

    const controller = new AbortController();

    await apiFetch(RESOURCE, schema, { signal: controller.signal });

    const options = fetchSpy.mock.calls[0]?.[1];

    expect(options?.signal?.aborted).toBeFalsy();

    controller.abort();

    expect(options?.signal?.aborted).toBeTruthy();
  });
});
