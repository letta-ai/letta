import type { Meta, StoryObj } from '@storybook/react';
import { RadioDot } from './RadioDot';

const meta: Meta<typeof RadioDot> = {
  component: RadioDot,
  title: 'core/RadioDot',
};

export default meta;
type Story = StoryObj<typeof RadioDot>;

export const Primary: Story = {
  args: {
    variant: 'default',
    size: 'medium',
    color: 'brand',
  },
  argTypes: {
    variant: {
      control: {
        type: 'select',
      },
      options: ['lsd', 'bullseye', 'default'],
    },
    size: {
      control: {
        type: 'select',
      },
      options: ['small', 'medium', 'large', 'grow'],
    },
    color: {
      control: {
        type: 'select',
      },
      options: ['brand'],
    },
  },
};
