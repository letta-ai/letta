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
    variant: {
      control: 'select',
      options: ['border', 'chips'],
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

export const FullWidth: Story = {
  argTypes: {
    items: {
      control: 'object',
    },
    defaultValue: {
      control: 'text',
    },
  },
  args: {
    fullWidth: true,
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
  parameters: {
    layout: 'fullscreen',
  },
};
