'use client';

import { RouteError } from '@/components/ui/route-error';

/**
 * Boundary for the marketing pages. It sits inside this route group, so it
 * renders within `BaseTemplate` and the header, nav, and footer stay on screen
 * while the error shows.
 *
 * @param props The thrown error and the reset callback Next.js provides.
 * @returns The rendered error state.
 */
export default function MarketingError(props: { error: Error; reset: () => void }) {
  return <RouteError error={props.error} reset={props.reset} />;
}
