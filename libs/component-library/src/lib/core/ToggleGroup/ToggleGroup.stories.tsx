import type { Meta, StoryObj } from '@storybook/react';
import { RawToggleGroup as ToggleGroup } from './ToggleGroup';

const meta: Meta<typeof ToggleGroup> = {
  component: ToggleGroup,
  title: 'core/ToggleGroup',
};

export default meta;
type Story = StoryObj<typeof ToggleGroup>;

export const Primary: Story = {
  argTypes: {
    items: {
      control: {
        type: 'object',
      },
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
  },
};
