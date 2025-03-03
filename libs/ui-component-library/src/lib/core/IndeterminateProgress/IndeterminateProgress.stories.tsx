import type { Meta, StoryObj } from '@storybook/react';
import { IndeterminateProgress } from './IndeterminateProgress';

const meta: Meta<typeof IndeterminateProgress> = {
  component: IndeterminateProgress,
  title: 'core/IndeterminateProgress',
};

export default meta;
type Story = StoryObj<typeof IndeterminateProgress>;

export const Primary: Story = {
  argTypes: {
    content: {
      control: {
        type: 'text',
      },
    },
    statusMessage: {
      control: {
        type: 'text',
      },
    },
  },
};
