import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from './Alert';
import { RocketIcon } from '../../icons';

const meta: Meta<typeof Alert> = {
  component: Alert,
  title: 'core/Alert',
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Primary: Story = {
  args: {
    children: 'I am an alert',
    title: 'Alert',
    variant: 'warning',
    icon: '',
  },
  argTypes: {
    icon: {
      options: ['none', '(custom)'],
      control: { type: 'radio' },
      mapping: {
        default: '',
        '(custom)': <RocketIcon />,
      },
    },
    variant: {
      options: ['warning', 'info', 'destructive'],
      control: { type: 'radio' },
    },
  },
};
