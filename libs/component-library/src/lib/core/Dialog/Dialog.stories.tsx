import type { Meta, StoryObj } from '@storybook/react';
import { Dialog } from './Dialog';
import { Button } from '../Button/Button';

const meta: Meta<typeof Dialog> = {
  component: Dialog,
  title: 'core/Dialog',
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Primary: Story = {
  argTypes: {
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
    onOpenChange: {},
    trigger: {},
    title: {
      control: {
        type: 'text',
      },
    },
    children: {
      control: {
        type: 'text',
      },
    },
  },
  args: {
    title: 'Dialog Title',
    children: 'Dialog Content',
    trigger: <Button label="Open Dialog"></Button>,
  },
};
