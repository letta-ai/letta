import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Core/Button',
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    label: 'Hello',
  },
  argTypes: {
    fullHeight: {
      control: {
        type: 'boolean',
      },
    },
    fullWidth: {
      control: {
        type: 'boolean',
      },
    },
    active: {
      control: {
        type: 'boolean',
      },
    },
    busy: {
      control: {
        type: 'boolean',
      },
    },
    variant: {
      options: ['default', 'inline-panel'],
      control: { type: 'radio' },
    },
    color: {
      options: ['primary', 'secondary', 'tertiary', 'destructive'],
      control: { type: 'radio' },
    },
  },
};
