import type { Meta, StoryObj } from '@storybook/react';
import { TabGroup } from './TabGroup';

const meta: Meta<typeof TabGroup> = {
  component: TabGroup,
  title: 'core/TabGroup',
};

export default meta;
type Story = StoryObj<typeof TabGroup>;

export const Primary: Story = {
  argTypes: {
    items: {
      control: 'object',
    },
    defaultValue: {
      control: 'text',
    },
  },
  args: {
    items: [
      {
        label: 'Option 1',
        value: 'option1',
      },
      {
        label: 'Option 2',
        value: 'option2',
      },
    ],
    defaultValue: 'option1',
  },
};
