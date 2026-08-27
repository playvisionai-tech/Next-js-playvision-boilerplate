import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { LocaleSwitcher } from './locale-switcher';

/*
 * A bare <select> with no visible label: its `aria-label` is the only thing
 * standing between this control and a screen reader announcing "combo box".
 * axe's select-name rule is the gate, and it is the whole reason this file is
 * here.
 */
const meta = {
  title: 'UI/LocaleSwitcher',
  component: LocaleSwitcher,
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
} satisfies Meta<typeof LocaleSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
