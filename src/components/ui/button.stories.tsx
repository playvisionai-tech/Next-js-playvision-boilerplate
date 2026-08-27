import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { XIcon } from 'lucide-react';
import { Button } from './button';

const meta = {
  title: 'UI/Button',
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Save changes',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Delete note',
    variant: 'destructive',
  },
};

/*
 * The reason this file exists. An icon-only button has no text node, so its
 * accessible name comes from the visually hidden span and nothing else —
 * delete that span and the button announces as "button" to a screen reader.
 * axe's button-name rule is what catches it.
 */
export const IconOnly: Story = {
  args: {
    size: 'icon',
    variant: 'ghost',
    children: (
      <>
        <XIcon />
        <span className="sr-only">Dismiss</span>
      </>
    ),
  },
};

export const Disabled: Story = {
  args: {
    children: 'Save changes',
    disabled: true,
  },
};
