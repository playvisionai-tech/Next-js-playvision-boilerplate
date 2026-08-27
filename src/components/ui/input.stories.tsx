import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './input';
import { Label } from './label';

/*
 * Input and Label are covered together on purpose: a label has no
 * accessibility on its own, and an input's has to come from somewhere. The
 * pairing is the contract, so the pairing is what the gate watches — drop the
 * `htmlFor`/`id` link and axe's label rule fails the run.
 */
const meta = {
  title: 'UI/Input',
  component: Input,
  render: (args) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="story-input">Note body</Label>
      <Input id="story-input" {...args} />
    </div>
  ),
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * Deliberately no placeholder. axe accepts a placeholder as an accessible name,
 * so a placeholder here would keep this story green with the `htmlFor` link
 * broken — the one regression it exists to catch.
 */
export const Labelled: Story = {};

export const Invalid: Story = {
  args: {
    'aria-invalid': true,
    defaultValue: 'x',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'Read only',
  },
};
