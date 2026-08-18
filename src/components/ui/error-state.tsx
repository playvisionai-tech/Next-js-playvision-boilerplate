'use client';

type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

/**
 * Recoverable failures. Client-only because retry is an event handler; if the
 * failure is not recoverable, render an EmptyState instead of a dead button.
 *
 * @param props Title, optional description, and an optional retry handler.
 * @returns The rendered error state.
 */
export const ErrorState = (props: ErrorStateProps) => (
  <div
    className="rounded-sm border border-red-200 bg-red-50 px-6 py-10 text-center"
    data-testid="error-state"
    role="alert"
  >
    <p className="font-bold text-red-700">{props.title}</p>
    {props.description && <p className="mt-1 text-sm text-red-600">{props.description}</p>}
    {props.onRetry && props.retryLabel && (
      <button
        className="mt-4 rounded-sm bg-red-600 px-5 py-1 font-bold text-white hover:bg-red-700 focus:ring-3 focus:ring-red-300/50 focus:outline-hidden"
        onClick={props.onRetry}
        type="button"
      >
        {props.retryLabel}
      </button>
    )}
  </div>
);
