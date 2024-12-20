import type { Meta, StoryObj } from '@storybook/react';
import { MessageWrapper } from './MessageWrapper';

const meta: Meta<typeof MessageWrapper> = {
  component: MessageWrapper,
  title: 'core/MessageWrapper',
};

export default meta;
type Story = StoryObj<typeof MessageWrapper>;

export const Primary: Story = {
  args: {
    header: {
      preIcon: null,
      title: 'Hello',
      badge: null,
    },
    type: 'code',
    children: 'Hello World',
  },
  argTypes: {
    type: {
      options: ['code', 'reasoningMessage', 'default'],
      control: {
        type: 'radio',
      },
    },
  },
};
