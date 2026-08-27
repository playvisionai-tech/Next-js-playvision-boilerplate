import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

/*
 * Rendered open, because a closed dialog is an empty div and there is nothing
 * to check. The accessible name comes from DialogTitle via aria-labelledby, and
 * the close affordance in the corner is an icon button whose name is the
 * visually hidden span — both are the kind of thing that disappears in a
 * refactor without anyone noticing.
 *
 * `context: 'body'` because the popup is portalled out of the story root, and
 * axe's default scan root would otherwise see an empty canvas and pass.
 */
const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    a11y: { context: 'body' },
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    defaultOpen: true,
    children: (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this note?</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep it</DialogClose>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    ),
  },
};

export const Closed: Story = {
  args: {
    children: (
      <>
        <DialogTrigger render={<Button variant="outline" />}>Delete this note</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this note?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </>
    ),
  },
};
