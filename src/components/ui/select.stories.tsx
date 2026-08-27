import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const items = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

/*
 * The trigger takes its accessible name from a Label, and the popup is a real
 * listbox with real options. `context: 'body'` because the popup is portalled
 * out of the story root; without it axe would scan a canvas holding only the
 * trigger and report the open state as clean whatever it contained.
 */
const meta = {
  title: 'UI/Select',
  component: Select,
  parameters: {
    a11y: { context: 'body' },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const render = (defaultOpen: boolean) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor="story-select">Note status</Label>
    <Select defaultOpen={defaultOpen} defaultValue="draft" items={items}>
      <SelectTrigger id="story-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export const Closed: Story = {
  render: () => render(false),
};

export const Open: Story = {
  render: () => render(true),
};
