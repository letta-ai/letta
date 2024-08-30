import type { Meta, StoryObj } from '@storybook/react';
import { Typography } from './Typography';

const meta: Meta<typeof Typography> = {
  component: Typography,
  title: 'Core/Typography',
};

export default meta;
type Story = StoryObj<typeof Typography>;

export const Primary: Story = {
  args: {
    children: 'I am text',
  },
  argTypes: {
    bold: {
      control: { type: 'boolean' },
    },
    color: {
      options: ['default', 'muted', 'white'],
      control: { type: 'radio' },
    },
    variant: {
      options: ['heading1', 'body'],
      control: { type: 'radio' },
    },
  },
};
