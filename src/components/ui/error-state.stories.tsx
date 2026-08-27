import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ErrorState } from './error-state';

/*
 * ErrorState carries `role="alert"` and, when it can retry, a real button. Both
 * are announced, so both are worth a gate: an invalid role or a button that
 * loses its text content fails here rather than in production.
 */
const meta = {
  title: 'UI/ErrorState',
  component: ErrorState,
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRetry: Story = {
  args: {
    title: 'Something went wrong',
    description: 'The page could not be loaded.',
    retryLabel: 'Try again',
    onRetry: () => {
      // Storybook needs a handler for the button to render; it does nothing.
    },
  },
};

export const WithoutRetry: Story = {
  args: {
    title: 'Something went wrong',
    description: 'The page could not be loaded.',
  },
};
