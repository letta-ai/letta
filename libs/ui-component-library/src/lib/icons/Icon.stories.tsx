import type { Meta, StoryObj } from '@storybook/react';
import { CircleIcon } from './';

const meta: Meta<typeof CircleIcon> = {
  component: CircleIcon,
  title: 'Core/Icon',
  tags: ['!autodoc'],
};

export default meta;
type Story = StoryObj<typeof CircleIcon>;

export const Primary: Story = {
  tags: ['!autodoc'],
  argTypes: {
    color: {
      options: ['primary', 'default'],
      control: { type: 'radio' },
    },
  },
};
