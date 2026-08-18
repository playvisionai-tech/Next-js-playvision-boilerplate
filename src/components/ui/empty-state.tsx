import type React from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

/**
 * Zero-result and first-run states. Server-safe: it renders text and whatever
 * node the caller passes as an action, and holds no state of its own.
 *
 * @param props Title, optional description, and an optional action node.
 * @returns The rendered empty state.
 */
export const EmptyState = (props: EmptyStateProps) => (
  <div
    className="rounded-sm border border-gray-200 px-6 py-10 text-center"
    data-testid="empty-state"
  >
    <p className="font-bold text-gray-700">{props.title}</p>
    {props.description && <p className="mt-1 text-sm text-gray-500">{props.description}</p>}
    {props.action && <div className="mt-4">{props.action}</div>}
  </div>
);
