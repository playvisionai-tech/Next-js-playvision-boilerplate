'use client';

import { RouteError } from '@/components/ui/route-error';

/**
 * Last-resort boundary for the locale segment. It catches what the route-group
 * boundaries structurally cannot: a throw from `(marketing)/layout.tsx` or
 * `(auth)/layout.tsx` themselves, and from `[...rest]`, which sits in no group.
 *
 * Because it lives above those layouts, rendering it *does* lose the header and
 * nav — that is the cost of being the boundary that still works when the layout
 * rendering the chrome is the thing that failed. Anything thrown inside a page
 * is caught lower down, by the boundary in its route group, which keeps the
 * chrome. The alternative to this file is `global-error.tsx`, which replaces the
 * whole document.
 *
 * @param props The thrown error and the reset callback Next.js provides.
 * @returns The rendered error state.
 */
export default function LocaleError(props: { error: Error; reset: () => void }) {
  return <RouteError error={props.error} reset={props.reset} />;
}
