'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createApiQueryClient } from './query';

/**
 * Publishes the query cache to everything below it.
 *
 * Mounted at the smallest subtree that reads a third-party API — today that is
 * `src/features/example`, not `src/app/[locale]/layout.tsx`. Mounting it in the
 * root layout would put react-query in the shared client chunk of every
 * production page, and the only consumer today is a route that does not exist
 * in production. `spec.md` records when that trade flips.
 *
 * The client is created in state, so each mount owns one and a server render
 * never shares a cache between two requests.
 *
 * @param props Children rendered inside the cache context.
 * @returns The children, wrapped in the query client context.
 */
export const ApiProvider = (props: { children: React.ReactNode }) => {
  const [client] = useState(createApiQueryClient);

  return <QueryClientProvider client={client}>{props.children}</QueryClientProvider>;
};
