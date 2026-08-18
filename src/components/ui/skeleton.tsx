type SkeletonProps = {
  className?: string;
};

/**
 * Suspense fallback. Server-safe: no state, no effects.
 *
 * @param props Optional class overriding the default size.
 * @returns The rendered placeholder.
 */
export const Skeleton = (props: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-sm bg-gray-200 ${props.className ?? 'h-5 w-40'}`}
    data-testid="skeleton"
  />
);
