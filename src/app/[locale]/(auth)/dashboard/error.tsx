'use client';

import { RouteError } from '@/components/ui/route-error';

/**
 * Boundary for the dashboard. `BaseTemplate` is rendered by
 * `dashboard/layout.tsx` rather than by `(auth)/layout.tsx`, so the boundary has
 * to sit here — one segment lower than the marketing one — for the header and
 * nav to stay on screen while the error shows.
 *
 * @param props The thrown error and the reset callback Next.js provides.
 * @returns The rendered error state.
 */
export default function DashboardError(props: { error: Error; reset: () => void }) {
  return <RouteError error={props.error} reset={props.reset} />;
}
