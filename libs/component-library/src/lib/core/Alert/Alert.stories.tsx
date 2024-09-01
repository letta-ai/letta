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
  },
  argTypes: {
    icon: {
      options: ['default', '<RocketIcon />'],
      control: { type: 'radio' },
      mapping: {
        default: null,
        '<RocketIcon />': <RocketIcon />,
      },
    },
    variant: {
      options: ['warning'],
      control: { type: 'radio' },
    },
  },
};
